'use client';

import { useState, useEffect } from 'react';
import { 
  getServices, 
  getAvailableSlots, 
  getMyBookings, 
  createBooking,
  cancelBooking,
  formatCurrency, 
  formatDate, 
  formatTime,
  formatDuration,
  getBookingStatusColor,
  Service, 
  ServiceCategory, 
  TimeSlot,
  Booking 
} from '@/lib/api';

type BookingStep = 'services' | 'date' | 'time' | 'confirm' | 'success';

// Selected service with quantity
interface SelectedService {
  service: Service;
  quantity: number;
}

export default function BookingsPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Booking flow state - now supports multiple services
  const [step, setStep] = useState<BookingStep>('services');
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showBookingFlow, setShowBookingFlow] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [servicesData, bookingsData] = await Promise.all([
        getServices(),
        getMyBookings()
      ]);
      setServices(servicesData.services);
      setCategories(servicesData.categories);
      setMyBookings(bookingsData.bookings);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Calculate total duration of all selected services
  const totalDuration = selectedServices.reduce((sum, item) => {
    return sum + (item.service.duration_minutes * item.quantity);
  }, 0);

  // Calculate total price of all selected services
  const totalPrice = selectedServices.reduce((sum, item) => {
    return sum + (item.service.price * item.quantity);
  }, 0);

  // Get the longest lead time from selected services
  const maxLeadTimeHours = Math.max(...selectedServices.map(s => s.service.lead_time_hours), 24);
  
  // Get the shortest max advance days from selected services
  const minMaxAdvanceDays = Math.min(...selectedServices.map(s => s.service.max_advance_days), 90);

  const loadSlots = async (date: string) => {
    if (selectedServices.length === 0) return;
    
    try {
      // For multi-service, we need to find slots that fit the total duration
      // Use the first service to get base availability, then filter by duration
      const data = await getAvailableSlots(selectedServices[0].service.id, date);
      
      // Filter slots to only show those that can accommodate total duration
      // This is a simplified approach - the backend should ideally handle this
      const filteredSlots = data.slots.filter((slot: TimeSlot) => {
        // Check if there's enough time from this slot's start to end of day
        const slotStart = new Date(slot.start_time);
        const neededEnd = new Date(slotStart.getTime() + totalDuration * 60 * 1000);
        const dayEnd = new Date(slotStart);
        dayEnd.setHours(23, 59, 59);
        return neededEnd <= dayEnd;
      });
      
      setAvailableSlots(filteredSlots);
    } catch (err: any) {
      setError(err.message);
      setAvailableSlots([]);
    }
  };

  const handleToggleService = (service: Service) => {
    setSelectedServices(prev => {
      const existing = prev.find(s => s.service.id === service.id);
      if (existing) {
        // Remove if already selected
        return prev.filter(s => s.service.id !== service.id);
      } else {
        // Add with quantity 1
        return [...prev, { service, quantity: 1 }];
      }
    });
  };

  const handleUpdateQuantity = (serviceId: string, delta: number) => {
    setSelectedServices(prev => {
      return prev.map(item => {
        if (item.service.id === serviceId) {
          const newQty = Math.max(1, item.quantity + delta);
          return { ...item, quantity: newQty };
        }
        return item;
      });
    });
  };

  const handleContinueToDate = () => {
    if (selectedServices.length > 0) {
      setStep('date');
    }
  };

  const handleSelectDate = async (date: string) => {
    setSelectedDate(date);
    await loadSlots(date);
    setStep('time');
  };

  const handleSelectSlot = (slot: TimeSlot) => {
    // Calculate end time based on total duration
    const startTime = new Date(slot.start_time);
    const endTime = new Date(startTime.getTime() + totalDuration * 60 * 1000);
    
    setSelectedSlot({
      ...slot,
      end_time: endTime.toISOString()
    });
    setStep('confirm');
  };

  const handleSubmitBooking = async () => {
    if (selectedServices.length === 0 || !selectedSlot) return;
    
    try {
      setSubmitting(true);
      
      // Create a booking for the combined services
      // The title will include all services
      const serviceNames = selectedServices.map(s => 
        s.quantity > 1 ? `${s.service.name} (x${s.quantity})` : s.service.name
      ).join(', ');
      
      // Use the first service as the primary service ID
      // Notes will contain the full breakdown
      const bookingNotes = `Services: ${serviceNames}\nTotal Duration: ${formatDuration(totalDuration)}\n${notes}`;
      
      await createBooking({
        service_id: selectedServices[0].service.id,
        start_time: selectedSlot.start_time,
        end_time: selectedSlot.end_time,
        notes: bookingNotes,
      });
      
      setStep('success');
      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    if (!confirm('Are you sure you want to cancel this booking?')) return;
    
    try {
      await cancelBooking(bookingId);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const resetBookingFlow = () => {
    setStep('services');
    setSelectedServices([]);
    setSelectedDate('');
    setAvailableSlots([]);
    setSelectedSlot(null);
    setNotes('');
    setShowBookingFlow(false);
  };

  const getMinDate = () => {
    const today = new Date();
    today.setHours(today.getHours() + maxLeadTimeHours);
    return today.toISOString().split('T')[0];
  };

  const getMaxDate = () => {
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + minMaxAdvanceDays);
    return maxDate.toISOString().split('T')[0];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Booking Flow Modal
  if (showBookingFlow) {
    return (
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Book Services</h1>
          <button 
            onClick={resetBookingFlow}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center mb-8">
          {['Services', 'Date', 'Time', 'Confirm'].map((label, index) => {
            const stepIndex = ['services', 'date', 'time', 'confirm'].indexOf(step);
            const isActive = index <= stepIndex;
            const isCurrent = index === stepIndex;
            
            return (
              <div key={label} className="flex items-center flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  isActive 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                }`}>
                  {index + 1}
                </div>
                <span className={`ml-2 text-sm ${isCurrent ? 'font-medium text-gray-900 dark:text-white' : 'text-gray-500'}`}>
                  {label}
                </span>
                {index < 3 && (
                  <div className={`flex-1 h-0.5 mx-4 ${isActive ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'}`} />
                )}
              </div>
            );
          })}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Step Content */}
        {step === 'services' && (
          <div>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Select one or more services (you can adjust quantities)
            </p>
            
            {categories.map(category => {
              const categoryServices = services.filter(s => s.category_id === category.id);
              if (categoryServices.length === 0) return null;
              
              return (
                <div key={category.id} className="mb-6">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                    {category.name}
                  </h3>
                  <div className="space-y-2">
                    {categoryServices.map(service => {
                      const selected = selectedServices.find(s => s.service.id === service.id);
                      const isSelected = !!selected;
                      
                      return (
                        <div
                          key={service.id}
                          className={`p-4 rounded-lg border-2 transition-colors ${
                            isSelected
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                              : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div 
                              className="flex-1 cursor-pointer"
                              onClick={() => handleToggleService(service)}
                            >
                              <div className="flex items-center">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => handleToggleService(service)}
                                  className="w-4 h-4 text-blue-600 rounded mr-3"
                                />
                                <div>
                                  <h4 className="font-medium text-gray-900 dark:text-white">
                                    {service.name}
                                  </h4>
                                  {service.description && (
                                    <p className="text-sm text-gray-500 dark:text-gray-400">
                                      {service.description}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="text-right ml-4">
                              <div className="font-medium text-gray-900 dark:text-white">
                                {formatCurrency(service.price)}
                              </div>
                              <div className="text-sm text-gray-500">
                                {formatDuration(service.duration_minutes)}
                              </div>
                            </div>
                          </div>
                          
                          {/* Quantity selector when selected */}
                          {isSelected && (
                            <div className="mt-3 flex items-center justify-end space-x-3">
                              <span className="text-sm text-gray-600 dark:text-gray-400">Quantity:</span>
                              <button
                                onClick={() => handleUpdateQuantity(service.id, -1)}
                                className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-600"
                                disabled={selected?.quantity === 1}
                              >
                                -
                              </button>
                              <span className="font-medium w-8 text-center">{selected?.quantity || 1}</span>
                              <button
                                onClick={() => handleUpdateQuantity(service.id, 1)}
                                className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-600"
                              >
                                +
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            
            {/* Summary Footer */}
            {selectedServices.length > 0 && (
              <div className="sticky bottom-0 bg-white dark:bg-gray-900 border-t dark:border-gray-700 pt-4 mt-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {selectedServices.length} service{selectedServices.length > 1 ? 's' : ''} selected
                    </p>
                    <p className="font-medium text-gray-900 dark:text-white">
                      Total: {formatCurrency(totalPrice)} • {formatDuration(totalDuration)}
                    </p>
                  </div>
                  <button
                    onClick={handleContinueToDate}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 'date' && (
          <div>
            <button 
              onClick={() => setStep('services')}
              className="text-blue-600 hover:text-blue-700 mb-4 flex items-center"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to services
            </button>
            
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Select a date for your {formatDuration(totalDuration)} appointment
            </p>
            
            <input
              type="date"
              min={getMinDate()}
              max={getMaxDate()}
              value={selectedDate}
              onChange={(e) => handleSelectDate(e.target.value)}
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            />
          </div>
        )}

        {step === 'time' && (
          <div>
            <button 
              onClick={() => setStep('date')}
              className="text-blue-600 hover:text-blue-700 mb-4 flex items-center"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to date
            </button>
            
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Select a start time on {formatDate(selectedDate)}
            </p>
            
            {availableSlots.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No available times on this date. Please select another date.
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {availableSlots.map((slot, index) => (
                  <button
                    key={index}
                    onClick={() => handleSelectSlot(slot)}
                    className="p-3 text-center border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                  >
                    {formatTime(slot.start_time)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 'confirm' && selectedSlot && (
          <div>
            <button 
              onClick={() => setStep('time')}
              className="text-blue-600 hover:text-blue-700 mb-4 flex items-center"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to time
            </button>
            
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6">
              <h3 className="font-medium text-gray-900 dark:text-white mb-4">Booking Summary</h3>
              
              {/* Services List */}
              <div className="space-y-2 mb-4">
                {selectedServices.map(item => (
                  <div key={item.service.id} className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">
                      {item.service.name} {item.quantity > 1 && `(x${item.quantity})`}
                    </span>
                    <span className="text-gray-900 dark:text-white">
                      {formatCurrency(item.service.price * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>
              
              <div className="border-t dark:border-gray-700 pt-3 space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Date</span>
                  <span className="text-gray-900 dark:text-white">{formatDate(selectedDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Time</span>
                  <span className="text-gray-900 dark:text-white">
                    {formatTime(selectedSlot.start_time)} - {formatTime(selectedSlot.end_time)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 dark:text-gray-400">Duration</span>
                  <span className="text-gray-900 dark:text-white">{formatDuration(totalDuration)}</span>
                </div>
                <div className="flex justify-between font-medium pt-2 border-t dark:border-gray-700">
                  <span className="text-gray-900 dark:text-white">Total</span>
                  <span className="text-gray-900 dark:text-white">{formatCurrency(totalPrice)}</span>
                </div>
              </div>
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                placeholder="Any special requests or information..."
              />
            </div>
            
            <button
              onClick={handleSubmitBooking}
              disabled={submitting}
              className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? 'Booking...' : 'Confirm Booking'}
            </button>
          </div>
        )}

        {step === 'success' && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Booking Requested!</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Your booking request has been submitted. You'll receive confirmation once it's approved.
            </p>
            <button
              onClick={resetBookingFlow}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Done
            </button>
          </div>
        )}
      </div>
    );
  }

  // Main Bookings View
  const upcomingBookings = myBookings.filter(b => 
    new Date(b.start_time) >= new Date() && ['pending', 'confirmed'].includes(b.status)
  );
  const pastBookings = myBookings.filter(b => 
    new Date(b.start_time) < new Date() || ['completed', 'cancelled', 'no_show'].includes(b.status)
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bookings</h1>
        <button
          onClick={() => setShowBookingFlow(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Book a Service
        </button>
      </div>

      {/* Upcoming Bookings */}
      <div className="mb-8">
        <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Upcoming</h2>
        {upcomingBookings.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">No upcoming bookings</p>
        ) : (
          <div className="space-y-3">
            {upcomingBookings.map(booking => (
              <div 
                key={booking.id}
                className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      {booking.service?.name || booking.title}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(booking.start_time)} at {formatTime(booking.start_time)}
                    </p>
                    {booking.notes && (
                      <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                        {booking.notes}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 text-xs rounded-full ${getBookingStatusColor(booking.status)}`}>
                      {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                    </span>
                    <button
                      onClick={() => handleCancelBooking(booking.id)}
                      className="text-red-600 hover:text-red-700 text-sm"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Past Bookings */}
      <div>
        <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Past</h2>
        {pastBookings.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">No past bookings</p>
        ) : (
          <div className="space-y-3">
            {pastBookings.map(booking => (
              <div 
                key={booking.id}
                className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 opacity-75"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      {booking.service?.name || booking.title}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(booking.start_time)} at {formatTime(booking.start_time)}
                    </p>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${getBookingStatusColor(booking.status)}`}>
                    {booking.status.charAt(0).toUpperCase() + booking.status.slice(1).replace('_', ' ')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
