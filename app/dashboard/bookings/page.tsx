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

export default function BookingsPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Booking flow state
  const [step, setStep] = useState<BookingStep>('services');
  const [selectedService, setSelectedService] = useState<Service | null>(null);
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

  const loadSlots = async (date: string) => {
    if (!selectedService) return;
    
    try {
      const data = await getAvailableSlots(selectedService.id, date);
      setAvailableSlots(data.slots);
    } catch (err: any) {
      setError(err.message);
      setAvailableSlots([]);
    }
  };

  const handleSelectService = (service: Service) => {
    setSelectedService(service);
    setStep('date');
  };

  const handleSelectDate = async (date: string) => {
    setSelectedDate(date);
    await loadSlots(date);
    setStep('time');
  };

  const handleSelectSlot = (slot: TimeSlot) => {
    setSelectedSlot(slot);
    setStep('confirm');
  };

  const handleSubmitBooking = async () => {
    if (!selectedService || !selectedSlot) return;
    
    try {
      setSubmitting(true);
      await createBooking({
        service_id: selectedService.id,
        start_time: selectedSlot.start_time,
        end_time: selectedSlot.end_time,
        notes: notes,
      });
      setStep('success');
      await loadData(); // Refresh bookings list
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
    setSelectedService(null);
    setSelectedDate('');
    setAvailableSlots([]);
    setSelectedSlot(null);
    setNotes('');
    setShowBookingFlow(false);
  };

  const getMinDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const getMaxDate = () => {
    const maxDays = selectedService?.max_advance_days || 90;
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + maxDays);
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Book a Service</h1>
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
          {['Service', 'Date', 'Time', 'Confirm'].map((label, index) => {
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
          <div className="space-y-4">
            <p className="text-gray-600 dark:text-gray-400 mb-4">Select a service to book:</p>
            {categories.map(category => {
              const categoryServices = services.filter(s => s.category_id === category.id && s.is_active);
              if (categoryServices.length === 0) return null;
              
              return (
                <div key={category.id} className="mb-6">
                  <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">{category.name}</h3>
                  <div className="space-y-2">
                    {categoryServices.map(service => (
                      <button
                        key={service.id}
                        onClick={() => handleSelectService(service)}
                        className="w-full p-4 text-left bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 transition"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium text-gray-900 dark:text-white">{service.name}</h4>
                            {service.description && (
                              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{service.description}</p>
                            )}
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                              {formatDuration(service.duration_minutes)}
                            </p>
                          </div>
                          <span className="text-lg font-semibold text-blue-600">{formatCurrency(service.price)}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
            {/* Uncategorized services */}
            {services.filter(s => !s.category_id && s.is_active).map(service => (
              <button
                key={service.id}
                onClick={() => handleSelectService(service)}
                className="w-full p-4 text-left bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 transition"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">{service.name}</h4>
                    {service.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{service.description}</p>
                    )}
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                      {formatDuration(service.duration_minutes)}
                    </p>
                  </div>
                  <span className="text-lg font-semibold text-blue-600">{formatCurrency(service.price)}</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {step === 'date' && selectedService && (
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg mb-4">
              <p className="font-medium text-blue-900 dark:text-blue-100">{selectedService.name}</p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                {formatDuration(selectedService.duration_minutes)} • {formatCurrency(selectedService.price)}
              </p>
            </div>
            
            <p className="text-gray-600 dark:text-gray-400 mb-4">Select a date:</p>
            
            <input
              type="date"
              min={getMinDate()}
              max={getMaxDate()}
              value={selectedDate}
              onChange={(e) => handleSelectDate(e.target.value)}
              className="w-full p-3 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
            
            <button
              onClick={() => setStep('services')}
              className="mt-4 text-blue-600 hover:text-blue-700"
            >
              ← Back to services
            </button>
          </div>
        )}

        {step === 'time' && selectedService && (
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg mb-4">
              <p className="font-medium text-blue-900 dark:text-blue-100">{selectedService.name}</p>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                {formatDate(selectedDate)} • {formatDuration(selectedService.duration_minutes)} • {formatCurrency(selectedService.price)}
              </p>
            </div>
            
            <p className="text-gray-600 dark:text-gray-400 mb-4">Select a time:</p>
            
            {availableSlots.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 dark:text-gray-400">No available times on this date.</p>
                <button
                  onClick={() => setStep('date')}
                  className="mt-4 text-blue-600 hover:text-blue-700"
                >
                  ← Choose a different date
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {availableSlots.map((slot, index) => (
                  <button
                    key={index}
                    onClick={() => handleSelectSlot(slot)}
                    className="p-3 text-center bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-500 transition text-gray-900 dark:text-white"
                  >
                    {formatTime(slot.start_time)}
                  </button>
                ))}
              </div>
            )}
            
            <button
              onClick={() => setStep('date')}
              className="mt-4 text-blue-600 hover:text-blue-700"
            >
              ← Back to date
            </button>
          </div>
        )}

        {step === 'confirm' && selectedService && selectedSlot && (
          <div className="space-y-4">
            <div className="p-6 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Booking Summary</h3>
              
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Service</span>
                  <span className="font-medium text-gray-900 dark:text-white">{selectedService.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Date</span>
                  <span className="font-medium text-gray-900 dark:text-white">{formatDate(selectedDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Time</span>
                  <span className="font-medium text-gray-900 dark:text-white">
                    {formatTime(selectedSlot.start_time)} - {formatTime(selectedSlot.end_time)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Duration</span>
                  <span className="font-medium text-gray-900 dark:text-white">{formatDuration(selectedService.duration_minutes)}</span>
                </div>
                <div className="pt-3 border-t border-gray-200 dark:border-slate-700 flex justify-between">
                  <span className="text-gray-900 dark:text-white font-medium">Total</span>
                  <span className="text-xl font-bold text-blue-600">{formatCurrency(selectedService.price)}</span>
                </div>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Any special requests or information..."
                className="w-full p-3 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
              />
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setStep('time')}
                className="flex-1 py-3 px-4 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition"
              >
                Back
              </button>
              <button
                onClick={handleSubmitBooking}
                disabled={submitting}
                className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold rounded-lg transition"
              >
                {submitting ? 'Booking...' : 'Confirm Booking'}
              </button>
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Booking Submitted!</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              Your booking request has been sent. You'll receive a confirmation once it's approved.
            </p>
            <button
              onClick={resetBookingFlow}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition"
            >
              Done
            </button>
          </div>
        )}
      </div>
    );
  }

  // Main Bookings View
  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Bookings</h1>
        <button
          onClick={() => setShowBookingFlow(true)}
          className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Book a Service
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
        </div>
      )}

      {myBookings.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700">
          <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-gray-500 dark:text-gray-400 mb-4">You don't have any bookings yet.</p>
          <button
            onClick={() => setShowBookingFlow(true)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition"
          >
            Book a Service
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Upcoming & Pending */}
          {myBookings.filter(b => b.status === 'pending' || b.status === 'confirmed').length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Upcoming</h2>
              <div className="space-y-3">
                {myBookings
                  .filter(b => b.status === 'pending' || b.status === 'confirmed')
                  .map(booking => (
                    <div
                      key={booking.id}
                      className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium text-gray-900 dark:text-white">{booking.title}</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            {formatDate(booking.start_time)} at {formatTime(booking.start_time)}
                          </p>
                          {booking.service && (
                            <p className="text-sm text-blue-600 mt-1">{booking.service.name}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 text-xs font-medium rounded ${getBookingStatusColor(booking.status)}`}>
                            {booking.status.charAt(0).toUpperCase() + booking.status.slice(1).replace('_', ' ')}
                          </span>
                          {(booking.status === 'pending' || booking.status === 'confirmed') && (
                            <button
                              onClick={() => handleCancelBooking(booking.id)}
                              className="text-red-600 hover:text-red-700 text-sm"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Past Bookings */}
          {myBookings.filter(b => b.status === 'completed' || b.status === 'cancelled' || b.status === 'no_show').length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Past</h2>
              <div className="space-y-3">
                {myBookings
                  .filter(b => b.status === 'completed' || b.status === 'cancelled' || b.status === 'no_show')
                  .map(booking => (
                    <div
                      key={booking.id}
                      className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 opacity-75"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium text-gray-900 dark:text-white">{booking.title}</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            {formatDate(booking.start_time)} at {formatTime(booking.start_time)}
                          </p>
                        </div>
                        <span className={`px-2 py-1 text-xs font-medium rounded ${getBookingStatusColor(booking.status)}`}>
                          {booking.status.charAt(0).toUpperCase() + booking.status.slice(1).replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
