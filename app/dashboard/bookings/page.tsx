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
  getClient,
  Service, 
  ServiceCategory, 
  TimeSlot,
  Booking 
} from '@/lib/api';
import { Language, translations } from '@/lib/translations';

type BookingStep = 'services' | 'datetime' | 'location' | 'confirm' | 'success';

interface SelectedService {
  service: Service;
  quantity: number;
}

interface LocationInfo {
  address: string;
  contactName: string;
  contactPhone: string;
  useClientInfo: boolean;
}

export default function BookingsPage() {
  const [lang, setLang] = useState<Language>('en');
  const t = (key: keyof typeof translations.en) => translations[lang][key] || key;
  
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const [step, setStep] = useState<BookingStep>('services');
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showBookingFlow, setShowBookingFlow] = useState(false);
  
  const [locationInfo, setLocationInfo] = useState<LocationInfo>({
    address: '',
    contactName: '',
    contactPhone: '',
    useClientInfo: true,
  });

  const clientInfo = getClient();

  useEffect(() => {
    loadData();
    const savedLang = localStorage.getItem('portal_language') as Language;
    if (savedLang && (savedLang === 'en' || savedLang === 'fr')) {
      setLang(savedLang);
    }
  }, []);

  const handleLanguageChange = (newLang: Language) => {
    setLang(newLang);
    localStorage.setItem('portal_language', newLang);
  };

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

  const totalDuration = selectedServices.reduce((sum, item) => 
    sum + (item.service.duration_minutes * item.quantity), 0);

  const totalPrice = selectedServices.reduce((sum, item) => 
    sum + (item.service.price * item.quantity), 0);

  const maxLeadTimeHours = Math.max(...selectedServices.map(s => s.service.lead_time_hours), 24);
  const minMaxAdvanceDays = Math.min(...selectedServices.map(s => s.service.max_advance_days), 90);

  const loadSlots = async (date: string) => {
    if (selectedServices.length === 0) return;
    setLoadingSlots(true);
    try {
      const data = await getAvailableSlots(selectedServices[0].service.id, date);
      const filteredSlots = data.slots.filter((slot: TimeSlot) => {
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
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleToggleService = (service: Service) => {
    setSelectedServices(prev => {
      const existing = prev.find(s => s.service.id === service.id);
      if (existing) return prev.filter(s => s.service.id !== service.id);
      return [...prev, { service, quantity: 1 }];
    });
  };

  const handleUpdateQuantity = (serviceId: string, delta: number) => {
    setSelectedServices(prev => prev.map(item => {
      if (item.service.id === serviceId) {
        return { ...item, quantity: Math.max(1, item.quantity + delta) };
      }
      return item;
    }));
  };

  const handleSelectDate = async (date: string) => {
    setSelectedDate(date);
    setSelectedSlot(null);
    await loadSlots(date);
  };

  const handleSelectSlot = (slot: TimeSlot) => {
    const startTime = new Date(slot.start_time);
    const endTime = new Date(startTime.getTime() + totalDuration * 60 * 1000);
    setSelectedSlot({ ...slot, end_time: endTime.toISOString() });
  };

  const handleSubmitBooking = async () => {
    if (selectedServices.length === 0 || !selectedSlot) return;
    try {
      setSubmitting(true);
      const serviceNames = selectedServices.map(s => 
        s.quantity > 1 ? `${s.service.name} (x${s.quantity})` : s.service.name
      ).join(', ');
      
      let bookingNotes = `Services: ${serviceNames}\nDuration: ${formatDuration(totalDuration)}\nLocation: ${locationInfo.address}\nOn-site Contact: ${locationInfo.contactName} - ${locationInfo.contactPhone}`;
      if (notes) bookingNotes += `\n\nNotes: ${notes}`;
      
      await createBooking({
        service_id: selectedServices[0].service.id,
        start_time: selectedSlot.start_time,
        end_time: selectedSlot.end_time,
        notes: bookingNotes,
        location_address: locationInfo.address,
        location_contact_name: locationInfo.contactName,
        location_contact_phone: locationInfo.contactPhone,
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
    if (!confirm(t('cancelBookingConfirm'))) return;
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
    setLocationInfo({ address: '', contactName: '', contactPhone: '', useClientInfo: true });
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#7C5DAF]"></div>
      </div>
    );
  }

  const LanguageSwitcher = () => (
    <div className="flex justify-end mb-4">
      <div className="flex items-center space-x-1 text-sm">
        <button onClick={() => handleLanguageChange('en')}
          className={`px-3 py-1.5 rounded-md font-medium transition-colors ${lang === 'en' ? 'bg-[#7C5DAF] text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
          EN
        </button>
        <button onClick={() => handleLanguageChange('fr')}
          className={`px-3 py-1.5 rounded-md font-medium transition-colors ${lang === 'fr' ? 'bg-[#7C5DAF] text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
          FR
        </button>
      </div>
    </div>
  );

  // Booking Flow Modal
  if (showBookingFlow) {
    const steps = [t('services'), t('dateAndTime'), t('location'), t('confirm')];
    const stepIndex = ['services', 'datetime', 'location', 'confirm'].indexOf(step);
    
    return (
      <div className="max-w-2xl mx-auto">
        <LanguageSwitcher />
        
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">{t('bookServices')}</h1>
          <button onClick={resetBookingFlow} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center mb-8">
          {steps.map((label, index) => (
            <div key={label} className="flex items-center flex-1 last:flex-initial">
              <div className="flex flex-col items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                  index < stepIndex 
                    ? 'bg-[#7C5DAF] text-white' 
                    : index === stepIndex 
                      ? 'bg-[#7C5DAF] text-white ring-4 ring-[#7C5DAF]/20' 
                      : 'bg-gray-100 text-gray-400'
                }`}>
                  {index < stepIndex ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </div>
                <span className={`mt-2 text-xs font-medium hidden sm:block ${
                  index === stepIndex ? 'text-gray-900' : 'text-gray-400'
                }`}>
                  {label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 sm:mx-4 ${
                  index < stepIndex ? 'bg-[#7C5DAF]' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {/* Step 1: Services */}
        {step === 'services' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <p className="text-gray-600 mb-4">{t('selectServicesDesc')}</p>
            
            {categories.map(category => {
              const categoryServices = services.filter(s => s.category_id === category.id);
              if (categoryServices.length === 0) return null;
              
              return (
                <div key={category.id} className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">{category.name}</h3>
                  <div className="space-y-3">
                    {categoryServices.map(service => {
                      const selected = selectedServices.find(s => s.service.id === service.id);
                      const isSelected = !!selected;
                      
                      return (
                        <div key={service.id}
                          className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                            isSelected ? 'border-[#7C5DAF] bg-[#7C5DAF]/5' : 'border-gray-200 hover:border-[#7C5DAF]/50'
                          }`}
                          onClick={() => handleToggleService(service)}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center flex-1">
                              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center mr-3 transition-colors ${
                                isSelected ? 'bg-[#7C5DAF] border-[#7C5DAF]' : 'border-gray-300'
                              }`}>
                                {isSelected && (
                                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                              <div>
                                <h4 className="font-medium text-gray-900">{service.name}</h4>
                                {service.description && <p className="text-sm text-gray-500">{service.description}</p>}
                              </div>
                            </div>
                            <div className="text-right ml-4">
                              <div className="font-semibold text-gray-900">{formatCurrency(service.price)}</div>
                              <div className="text-sm text-gray-500">{formatDuration(service.duration_minutes)}</div>
                            </div>
                          </div>
                          
                          {isSelected && (
                            <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-end gap-3" onClick={e => e.stopPropagation()}>
                              <span className="text-sm text-gray-500">{t('quantity')}:</span>
                              <button onClick={() => handleUpdateQuantity(service.id, -1)}
                                className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200 text-gray-600 font-medium transition-colors"
                                disabled={selected?.quantity === 1}>−</button>
                              <span className="font-medium w-8 text-center text-gray-900">{selected?.quantity || 1}</span>
                              <button onClick={() => handleUpdateQuantity(service.id, 1)}
                                className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200 text-gray-600 font-medium transition-colors">+</button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            
            {selectedServices.length > 0 && (
              <div className="sticky bottom-0 bg-white border-t border-gray-100 pt-4 mt-6 -mx-6 px-6 pb-6 -mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-500">{selectedServices.length} {t('servicesSelected')}</p>
                    <p className="font-semibold text-gray-900">{t('total')}: {formatCurrency(totalPrice)} • {formatDuration(totalDuration)}</p>
                  </div>
                  <button onClick={() => setStep('datetime')}
                    className="px-6 py-2.5 bg-[#7C5DAF] text-white rounded-lg hover:bg-[#6b4d9e] font-medium transition-colors">{t('continue')}</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Date & Time */}
        {step === 'datetime' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <button onClick={() => setStep('services')} className="text-[#7C5DAF] hover:text-[#6b4d9e] mb-4 flex items-center transition-colors">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>{t('back')}
            </button>

            <h2 className="text-xl font-semibold text-gray-900 mb-6">{t('dateAndTime')}</h2>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('selectDate')}</label>
                <input type="date" min={getMinDate()} max={getMaxDate()} value={selectedDate}
                  onChange={(e) => handleSelectDate(e.target.value)}
                  className="w-full p-3 border border-gray-200 rounded-lg text-gray-900 focus:ring-2 focus:ring-[#7C5DAF] focus:border-transparent" />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('selectTime')}</label>
                {!selectedDate ? (
                  <div className="p-4 border-2 border-dashed border-gray-200 rounded-lg text-center">
                    <p className="text-gray-400 text-sm">{t('selectDate')}</p>
                  </div>
                ) : loadingSlots ? (
                  <div className="flex items-center justify-center p-8">
                    <div className="w-6 h-6 border-2 border-[#7C5DAF] border-t-transparent rounded-full animate-spin"></div>
                  </div>
                ) : availableSlots.length === 0 ? (
                  <div className="p-4 border-2 border-dashed border-gray-200 rounded-lg text-center">
                    <p className="text-gray-400 text-sm">{t('noAvailableTimes')}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto p-1">
                    {availableSlots.map((slot, index) => (
                      <button key={index} onClick={() => handleSelectSlot(slot)}
                        className={`p-2.5 text-center rounded-lg font-medium transition-all ${
                          selectedSlot?.start_time === slot.start_time
                            ? 'bg-[#7C5DAF] text-white'
                            : 'bg-gray-50 text-gray-700 border border-gray-200 hover:border-[#7C5DAF] hover:bg-[#7C5DAF]/5'
                        }`}>{formatTime(slot.start_time)}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            {selectedSlot && (
              <div className="mt-6 flex justify-end">
                <button onClick={() => { if (clientInfo) setLocationInfo(prev => ({ ...prev, contactName: clientInfo.name || '' })); setStep('location'); }}
                  className="px-6 py-2.5 bg-[#7C5DAF] text-white rounded-lg hover:bg-[#6b4d9e] font-medium transition-colors">{t('continue')}</button>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Location */}
        {step === 'location' && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <button onClick={() => setStep('datetime')} className="text-[#7C5DAF] hover:text-[#6b4d9e] mb-4 flex items-center transition-colors">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>{t('back')}
            </button>

            <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('location')}</h2>
            <p className="text-gray-500 mb-6">{t('locationDesc')}</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('address')} *</label>
                <input type="text" value={locationInfo.address}
                  onChange={(e) => setLocationInfo(prev => ({ ...prev, address: e.target.value }))}
                  placeholder={t('enterAddress')}
                  className="w-full p-3 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-[#7C5DAF] focus:border-transparent" />
              </div>
              
              <div className="border-t border-gray-100 pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-3">{t('onSiteContact')}</label>
                
                <div className="flex items-center gap-4 mb-4">
                  <label className="flex items-center cursor-pointer">
                    <input type="radio" checked={locationInfo.useClientInfo}
                      onChange={() => setLocationInfo(prev => ({ ...prev, useClientInfo: true, contactName: clientInfo?.name || '', contactPhone: '' }))}
                      className="w-4 h-4 text-[#7C5DAF] border-gray-300 focus:ring-[#7C5DAF]" />
                    <span className="ml-2 text-sm text-gray-700">{t('sameAsClientInfo')}</span>
                  </label>
                  
                  <label className="flex items-center cursor-pointer">
                    <input type="radio" checked={!locationInfo.useClientInfo}
                      onChange={() => setLocationInfo(prev => ({ ...prev, useClientInfo: false, contactName: '', contactPhone: '' }))}
                      className="w-4 h-4 text-[#7C5DAF] border-gray-300 focus:ring-[#7C5DAF]" />
                    <span className="ml-2 text-sm text-gray-700">{t('customLocation')}</span>
                  </label>
                </div>
                
                {!locationInfo.useClientInfo && (
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">{t('contactName')}</label>
                      <input type="text" value={locationInfo.contactName}
                        onChange={(e) => setLocationInfo(prev => ({ ...prev, contactName: e.target.value }))}
                        placeholder={t('enterContactName')}
                        className="w-full p-3 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-[#7C5DAF] focus:border-transparent" />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">{t('contactPhone')}</label>
                      <input type="tel" value={locationInfo.contactPhone}
                        onChange={(e) => setLocationInfo(prev => ({ ...prev, contactPhone: e.target.value }))}
                        placeholder={t('enterContactPhone')}
                        className="w-full p-3 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-[#7C5DAF] focus:border-transparent" />
                    </div>
                  </div>
                )}
                
                {locationInfo.useClientInfo && clientInfo && (
                  <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                    <p className="text-sm font-medium text-gray-900">{clientInfo.name}</p>
                    <p className="text-sm text-gray-500">{clientInfo.email}</p>
                  </div>
                )}
              </div>
            </div>
            
            <div className="mt-6 flex justify-end">
              <button onClick={() => setStep('confirm')} disabled={!locationInfo.address.trim()}
                className="px-6 py-2.5 bg-[#7C5DAF] text-white rounded-lg hover:bg-[#6b4d9e] disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors">
                {t('continue')}
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Confirm */}
        {step === 'confirm' && selectedSlot && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <button onClick={() => setStep('location')} className="text-[#7C5DAF] hover:text-[#6b4d9e] mb-4 flex items-center transition-colors">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>{t('back')}
            </button>
            
            <h2 className="text-xl font-semibold text-gray-900 mb-6">{t('confirmBooking')}</h2>
            
            <div className="bg-gray-50 rounded-xl p-4 mb-4 border border-gray-100">
              <h3 className="font-medium text-gray-900 mb-3">{t('bookingSummary')}</h3>
              
              <div className="space-y-2 mb-4">
                {selectedServices.map(item => (
                  <div key={item.service.id} className="flex justify-between text-sm">
                    <span className="text-gray-600">{item.service.name} {item.quantity > 1 && `(x${item.quantity})`}</span>
                    <span className="text-gray-900 font-medium">{formatCurrency(item.service.price * item.quantity)}</span>
                  </div>
                ))}
              </div>
              
              <div className="border-t border-gray-200 pt-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t('date')}</span>
                  <span className="text-gray-900">{formatDate(selectedDate)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t('time')}</span>
                  <span className="text-gray-900">{formatTime(selectedSlot.start_time)} - {formatTime(selectedSlot.end_time)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t('duration')}</span>
                  <span className="text-gray-900">{formatDuration(totalDuration)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t('location')}</span>
                  <span className="text-gray-900 text-right max-w-xs">{locationInfo.address}</span>
                </div>
                <div className="flex justify-between font-semibold pt-2 border-t border-gray-200">
                  <span className="text-gray-900">{t('total')}</span>
                  <span className="text-[#7C5DAF]">{formatCurrency(totalPrice)}</span>
                </div>
              </div>
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('notes')} ({t('optional')})</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
                className="w-full p-3 border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-[#7C5DAF] focus:border-transparent"
                placeholder={t('notesPlaceholder')} />
            </div>
            
            <button onClick={handleSubmitBooking} disabled={submitting}
              className="w-full py-3 bg-[#7C5DAF] text-white rounded-lg hover:bg-[#6b4d9e] disabled:opacity-50 font-semibold transition-colors">
              {submitting ? t('loading') : t('confirmBookingBtn')}
            </button>
          </div>
        )}

        {/* Success */}
        {step === 'success' && (
          <div className="bg-white rounded-xl border border-gray-200 p-8 shadow-sm text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">{t('bookingRequested')}</h2>
            <p className="text-gray-500 mb-6">{t('bookingRequestedMsg')}</p>
            <button onClick={resetBookingFlow}
              className="px-6 py-2.5 bg-[#7C5DAF] text-white rounded-lg hover:bg-[#6b4d9e] font-medium transition-colors">{t('done')}</button>
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
      <LanguageSwitcher />
      
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{t('bookings')}</h1>
        <button onClick={() => setShowBookingFlow(true)}
          className="px-4 py-2.5 bg-[#7C5DAF] text-white rounded-lg hover:bg-[#6b4d9e] flex items-center font-medium transition-colors">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>{t('bookAService')}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      <div className="mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('upcoming')}</h2>
        {upcomingBookings.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-gray-500">{t('noUpcomingBookings')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {upcomingBookings.map(booking => (
              <div key={booking.id} className="p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{booking.service?.name || booking.title}</h3>
                    <p className="text-sm text-gray-500 mt-1">{formatDate(booking.start_time)} at {formatTime(booking.start_time)}</p>
                    {booking.notes && <p className="text-sm text-gray-600 mt-2 line-clamp-2">{booking.notes}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${getBookingStatusColor(booking.status)}`}>
                      {t(booking.status as keyof typeof translations.en)}
                    </span>
                    <button onClick={() => handleCancelBooking(booking.id)} className="text-red-500 hover:text-red-600 text-sm font-medium transition-colors">
                      {t('cancel')}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('past')}</h2>
        {pastBookings.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-gray-500">{t('noPastBookings')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pastBookings.map(booking => (
              <div key={booking.id} className="p-4 bg-white rounded-xl border border-gray-200 opacity-75">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900">{booking.service?.name || booking.title}</h3>
                    <p className="text-sm text-gray-500">{formatDate(booking.start_time)} at {formatTime(booking.start_time)}</p>
                  </div>
                  <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${getBookingStatusColor(booking.status)}`}>
                    {t(booking.status as keyof typeof translations.en)}
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
semibold text-white">{booking.service?.name || booking.title}</h3>
                    <p className="text-sm text-gray-500 mt-1">{formatDate(booking.start_time)} at {formatTime(booking.start_time)}</p>
                    {booking.notes && <p className="text-sm text-gray-400 mt-2 line-clamp-2">{booking.notes}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${getStatusStyle(booking.status)}`}>
                      {t(booking.status as any)}
                    </span>
                    <button onClick={() => handleCancelBooking(booking.id)} className="text-red-400 hover:text-red-300 text-sm font-medium transition-colors">
                      {t('cancel')}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold text-white mb-4">{t('past')}</h2>
        {pastBookings.length === 0 ? (
          <div className="bg-[#1a1a1e] rounded-xl border border-[#2a2a32] p-8 text-center">
            <p className="text-gray-500">{t('noPastBookings')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {pastBookings.map(booking => (
              <div key={booking.id} className="p-4 bg-[#1a1a1e] rounded-xl border border-[#2a2a32] opacity-75">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-white">{booking.service?.name || booking.title}</h3>
                    <p className="text-sm text-gray-500">{formatDate(booking.start_time)} at {formatTime(booking.start_time)}</p>
                  </div>
                  <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${getStatusStyle(booking.status)}`}>
                    {t(booking.status as any)}
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
