'use client';

import { useState, useEffect } from 'react';
import { Language, translations } from '@/lib/translations';

type BookingStep = 'client-info' | 'services' | 'datetime' | 'location' | 'confirm' | 'success';

interface ClientInfo {
  fullName: string;
  email: string;
  phone: string;
  billingAddress: string;
  billingCity: string;
  billingProvince: string;
  billingPostalCode: string;
}

interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  duration_minutes: number;
  category_id: string;
  lead_time_hours: number;
  max_advance_days: number;
}

interface ServiceCategory {
  id: string;
  name: string;
  color: string;
}

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

interface TimeSlot {
  start_time: string;
  end_time: string;
}

// API Configuration - Update these for your deployment
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export default function PublicBookingPage() {
  const [lang, setLang] = useState<Language>('en');
  const t = (key: keyof typeof translations.en) => translations[lang][key] || key;
  
  const [step, setStep] = useState<BookingStep>('client-info');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Client info
  const [clientInfo, setClientInfo] = useState<ClientInfo>({
    fullName: '',
    email: '',
    phone: '',
    billingAddress: '',
    billingCity: '',
    billingProvince: 'QC',
    billingPostalCode: '',
  });
  const [isExistingClient, setIsExistingClient] = useState(false);
  const [portalCode, setPortalCode] = useState('');
  const [lookingUpClient, setLookingUpClient] = useState(false);
  const [clientVerified, setClientVerified] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  
  // Services
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>([]);
  
  // Date/Time
  const [selectedDate, setSelectedDate] = useState('');
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  
  // Location
  const [locationInfo, setLocationInfo] = useState<LocationInfo>({
    address: '',
    contactName: '',
    contactPhone: '',
    useClientInfo: true,
  });
  
  // Notes
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Check for saved language preference
    const savedLang = localStorage.getItem('booking_language') as Language;
    if (savedLang && (savedLang === 'en' || savedLang === 'fr')) {
      setLang(savedLang);
    }
  }, []);

  const handleLanguageChange = (newLang: Language) => {
    setLang(newLang);
    localStorage.setItem('booking_language', newLang);
  };

  // Fetch services when moving to services step
  const loadServices = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${SUPABASE_URL}/functions/v1/portal-services`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) throw new Error('Failed to load services');
      
      const data = await response.json();
      setServices(data.services || []);
      setCategories(data.categories || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Look up existing client by portal code
  const handleLookupClient = async () => {
    if (!portalCode.trim()) return;
    
    setLookingUpClient(true);
    setError('');
    
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/portal-lookup-client`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ portal_code: portalCode.trim() }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Client not found');
      }
      
      const data = await response.json();
      
      // Auto-populate client info
      setClientInfo({
        fullName: data.client.name || '',
        email: data.client.email || '',
        phone: data.client.phone || '',
        billingAddress: data.client.billing_address || '',
        billingCity: data.client.billing_city || '',
        billingProvince: data.client.billing_province || 'QC',
        billingPostalCode: data.client.billing_postal_code || '',
      });
      
      setClientId(data.client.id);
      setClientVerified(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLookingUpClient(false);
    }
  };

  // Load available time slots
  const loadSlots = async (date: string) => {
    if (selectedServices.length === 0) return;
    
    setLoadingSlots(true);
    try {
      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/portal-available-slots?service_id=${selectedServices[0].service.id}&date=${date}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );
      
      if (!response.ok) throw new Error('Failed to load slots');
      
      const data = await response.json();
      
      // Filter slots for total duration
      const totalDuration = selectedServices.reduce((sum, item) => 
        sum + (item.service.duration_minutes * item.quantity), 0);
      
      const filteredSlots = (data.slots || []).filter((slot: TimeSlot) => {
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

  // Submit booking
  const handleSubmitBooking = async () => {
    if (selectedServices.length === 0 || !selectedSlot) return;
    
    try {
      setSubmitting(true);
      
      const totalDuration = selectedServices.reduce((sum, item) => 
        sum + (item.service.duration_minutes * item.quantity), 0);
      
      const serviceNames = selectedServices.map(s => 
        s.quantity > 1 ? `${s.service.name} (x${s.quantity})` : s.service.name
      ).join(', ');
      
      let bookingNotes = `Services: ${serviceNames}\n`;
      bookingNotes += `Duration: ${formatDuration(totalDuration)}\n`;
      bookingNotes += `Location: ${locationInfo.address}\n`;
      bookingNotes += `Contact: ${locationInfo.useClientInfo ? clientInfo.fullName : locationInfo.contactName}`;
      bookingNotes += ` - ${locationInfo.useClientInfo ? clientInfo.phone : locationInfo.contactPhone}\n`;
      if (notes) bookingNotes += `\nNotes: ${notes}`;
      
      const response = await fetch(`${SUPABASE_URL}/functions/v1/portal-public-booking`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Client info (for new clients or verification)
          client_id: clientId,
          client_info: !clientId ? {
            name: clientInfo.fullName,
            email: clientInfo.email,
            phone: clientInfo.phone,
            billing_address: clientInfo.billingAddress,
            billing_city: clientInfo.billingCity,
            billing_province: clientInfo.billingProvince,
            billing_postal_code: clientInfo.billingPostalCode,
          } : undefined,
          // Booking details
          service_id: selectedServices[0].service.id,
          start_time: selectedSlot.start_time,
          end_time: selectedSlot.end_time,
          notes: bookingNotes,
          location_address: locationInfo.address,
          location_contact_name: locationInfo.useClientInfo ? clientInfo.fullName : locationInfo.contactName,
          location_contact_phone: locationInfo.useClientInfo ? clientInfo.phone : locationInfo.contactPhone,
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create booking');
      }
      
      setStep('success');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Helpers
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(amount);
  };

  const formatDuration = (minutes: number) => {
    if (minutes === 0) return lang === 'fr' ? 'Aucune durée' : 'No duration';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins} min`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}min`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString(lang === 'fr' ? 'fr-CA' : 'en-CA', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const totalDuration = selectedServices.reduce((sum, item) => 
    sum + (item.service.duration_minutes * item.quantity), 0);

  const totalPrice = selectedServices.reduce((sum, item) => 
    sum + (item.service.price * item.quantity), 0);

  const maxLeadTimeHours = selectedServices.length > 0 
    ? Math.max(...selectedServices.map(s => s.service.lead_time_hours)) 
    : 24;
  const minMaxAdvanceDays = selectedServices.length > 0 
    ? Math.min(...selectedServices.map(s => s.service.max_advance_days)) 
    : 90;

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

  const isClientInfoValid = () => {
    return clientInfo.fullName.trim() && 
           clientInfo.email.trim() && 
           clientInfo.phone.trim() &&
           clientInfo.billingAddress.trim() &&
           clientInfo.billingCity.trim() &&
           clientInfo.billingPostalCode.trim();
  };

  const resetForm = () => {
    setStep('client-info');
    setClientInfo({
      fullName: '',
      email: '',
      phone: '',
      billingAddress: '',
      billingCity: '',
      billingProvince: 'QC',
      billingPostalCode: '',
    });
    setIsExistingClient(false);
    setPortalCode('');
    setClientVerified(false);
    setClientId(null);
    setSelectedServices([]);
    setSelectedDate('');
    setAvailableSlots([]);
    setSelectedSlot(null);
    setLocationInfo({ address: '', contactName: '', contactPhone: '', useClientInfo: true });
    setNotes('');
  };

  // Language Switcher
  const LanguageSwitcher = () => (
    <div className="flex items-center space-x-2 text-sm">
      <button onClick={() => handleLanguageChange('en')}
        className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
          lang === 'en' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
        }`}>
        English
      </button>
      <button onClick={() => handleLanguageChange('fr')}
        className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
          lang === 'fr' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
        }`}>
        Français
      </button>
    </div>
  );

  // Progress indicator
  const steps = [t('clientInfo'), t('services'), t('dateAndTime'), t('location'), t('confirm')];
  const stepKeys: BookingStep[] = ['client-info', 'services', 'datetime', 'location', 'confirm'];
  const currentStepIndex = stepKeys.indexOf(step);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">{t('bookServices')}</h1>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Progress Steps */}
        {step !== 'success' && (
          <div className="flex items-center mb-8 overflow-x-auto pb-2">
            {steps.map((label, index) => (
              <div key={label} className="flex items-center flex-shrink-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  index <= currentStepIndex ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'
                }`}>{index + 1}</div>
                <span className={`ml-2 text-sm whitespace-nowrap ${
                  index === currentStepIndex ? 'font-medium text-gray-900' : 'text-gray-500'
                }`}>{label}</span>
                {index < 4 && <div className={`w-8 h-0.5 mx-2 ${index < currentStepIndex ? 'bg-blue-600' : 'bg-gray-200'}`} />}
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600">{error}</p>
            <button onClick={() => setError('')} className="text-red-500 text-sm underline mt-1">
              {t('close')}
            </button>
          </div>
        )}

        {/* Step 1: Client Info */}
        {step === 'client-info' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">{t('clientInfo')}</h2>
            
            {/* Existing Client Toggle */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <span className="font-medium text-gray-900">{t('alreadyAClient')}</span>
                <button
                  onClick={() => { setIsExistingClient(!isExistingClient); setClientVerified(false); }}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    isExistingClient 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}>
                  {isExistingClient ? t('newClient') : t('alreadyAClient')}
                </button>
              </div>
              
              {isExistingClient && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-600">{t('enterPortalCode')}</p>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={portalCode}
                      onChange={(e) => setPortalCode(e.target.value.toUpperCase())}
                      placeholder={t('portalCode')}
                      className="flex-1 p-3 border border-gray-300 rounded-lg bg-white text-gray-900 uppercase"
                      maxLength={8}
                    />
                    <button
                      onClick={handleLookupClient}
                      disabled={lookingUpClient || !portalCode.trim()}
                      className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                      {lookingUpClient ? '...' : t('lookupClient')}
                    </button>
                  </div>
                  {clientVerified && (
                    <div className="flex items-center text-green-600">
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm font-medium">
                        {lang === 'fr' ? 'Client vérifié!' : 'Client verified!'}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Client Form */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('fullName')} *</label>
                <input
                  type="text"
                  value={clientInfo.fullName}
                  onChange={(e) => setClientInfo(prev => ({ ...prev, fullName: e.target.value }))}
                  className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-900"
                  disabled={clientVerified}
                />
              </div>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('email')} *</label>
                  <input
                    type="email"
                    value={clientInfo.email}
                    onChange={(e) => setClientInfo(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-900"
                    disabled={clientVerified}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('phone')} *</label>
                  <input
                    type="tel"
                    value={clientInfo.phone}
                    onChange={(e) => setClientInfo(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-900"
                    disabled={clientVerified}
                  />
                </div>
              </div>

              <div className="border-t pt-4 mt-4">
                <h3 className="font-medium text-gray-900 mb-3">{t('billingInfo')}</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('billingAddress')} *</label>
                    <input
                      type="text"
                      value={clientInfo.billingAddress}
                      onChange={(e) => setClientInfo(prev => ({ ...prev, billingAddress: e.target.value }))}
                      className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-900"
                      disabled={clientVerified}
                    />
                  </div>
                  
                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('city')} *</label>
                      <input
                        type="text"
                        value={clientInfo.billingCity}
                        onChange={(e) => setClientInfo(prev => ({ ...prev, billingCity: e.target.value }))}
                        className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-900"
                        disabled={clientVerified}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('province')}</label>
                      <select
                        value={clientInfo.billingProvince}
                        onChange={(e) => setClientInfo(prev => ({ ...prev, billingProvince: e.target.value }))}
                        className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-900"
                        disabled={clientVerified}
                      >
                        <option value="QC">Québec</option>
                        <option value="ON">Ontario</option>
                        <option value="BC">British Columbia</option>
                        <option value="AB">Alberta</option>
                        <option value="MB">Manitoba</option>
                        <option value="SK">Saskatchewan</option>
                        <option value="NS">Nova Scotia</option>
                        <option value="NB">New Brunswick</option>
                        <option value="NL">Newfoundland and Labrador</option>
                        <option value="PE">Prince Edward Island</option>
                        <option value="NT">Northwest Territories</option>
                        <option value="YT">Yukon</option>
                        <option value="NU">Nunavut</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{t('postalCode')} *</label>
                      <input
                        type="text"
                        value={clientInfo.billingPostalCode}
                        onChange={(e) => setClientInfo(prev => ({ ...prev, billingPostalCode: e.target.value.toUpperCase() }))}
                        placeholder="H1A 1A1"
                        className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-900 uppercase"
                        maxLength={7}
                        disabled={clientVerified}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => { loadServices(); setStep('services'); }}
                disabled={!isClientInfoValid()}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium">
                {t('continue')}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Services */}
        {step === 'services' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <button onClick={() => setStep('client-info')} className="text-blue-600 hover:text-blue-700 mb-4 flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>{t('back')}
            </button>

            <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('selectServices')}</h2>
            <p className="text-gray-600 mb-6">{t('selectServicesDesc')}</p>
            
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <>
                {categories.map(category => {
                  const categoryServices = services.filter(s => s.category_id === category.id);
                  if (categoryServices.length === 0) return null;
                  
                  return (
                    <div key={category.id} className="mb-6">
                      <h3 className="text-lg font-medium text-gray-900 mb-3">{category.name}</h3>
                      <div className="space-y-2">
                        {categoryServices.map(service => {
                          const selected = selectedServices.find(s => s.service.id === service.id);
                          const isSelected = !!selected;
                          
                          return (
                            <div key={service.id}
                              className={`p-4 rounded-lg border-2 transition-colors ${
                                isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                              }`}>
                              <div className="flex items-center justify-between">
                                <div className="flex-1 cursor-pointer" onClick={() => handleToggleService(service)}>
                                  <div className="flex items-center">
                                    <input type="checkbox" checked={isSelected} onChange={() => handleToggleService(service)}
                                      className="w-5 h-5 text-blue-600 rounded mr-3" />
                                    <div>
                                      <h4 className="font-medium text-gray-900">{service.name}</h4>
                                      {service.description && <p className="text-sm text-gray-500">{service.description}</p>}
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right ml-4">
                                  <div className="font-medium text-gray-900">{formatCurrency(service.price)}</div>
                                  <div className="text-sm text-gray-500">{formatDuration(service.duration_minutes)}</div>
                                </div>
                              </div>
                              
                              {isSelected && (
                                <div className="mt-3 flex items-center justify-end space-x-3">
                                  <span className="text-sm text-gray-600">{t('quantity')}:</span>
                                  <button onClick={() => handleUpdateQuantity(service.id, -1)}
                                    className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300 font-medium"
                                    disabled={selected?.quantity === 1}>−</button>
                                  <span className="font-medium w-8 text-center">{selected?.quantity || 1}</span>
                                  <button onClick={() => handleUpdateQuantity(service.id, 1)}
                                    className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300 font-medium">+</button>
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
                  <div className="sticky bottom-0 bg-white border-t pt-4 mt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600">{selectedServices.length} {t('servicesSelected')}</p>
                        <p className="font-medium text-gray-900">{t('total')}: {formatCurrency(totalPrice)} • {formatDuration(totalDuration)}</p>
                      </div>
                      <button onClick={() => setStep('datetime')}
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">{t('continue')}</button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Step 3: Date & Time */}
        {step === 'datetime' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <button onClick={() => setStep('services')} className="text-blue-600 hover:text-blue-700 mb-4 flex items-center">
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
                  className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-900" />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('selectTime')}</label>
                {!selectedDate ? (
                  <p className="text-gray-500 text-sm p-4 border border-dashed border-gray-300 rounded-lg text-center">
                    {t('selectDate')}
                  </p>
                ) : loadingSlots ? (
                  <div className="flex items-center justify-center p-8">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  </div>
                ) : availableSlots.length === 0 ? (
                  <p className="text-gray-500 text-sm p-4 border border-dashed border-gray-300 rounded-lg text-center">
                    {t('noAvailableTimes')}
                  </p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
                    {availableSlots.map((slot, index) => (
                      <button key={index} onClick={() => handleSelectSlot(slot)}
                        className={`p-3 text-center border rounded-lg transition-colors font-medium ${
                          selectedSlot?.start_time === slot.start_time
                            ? 'border-blue-500 bg-blue-50 text-blue-600'
                            : 'border-gray-200 hover:border-blue-500 hover:bg-blue-50'
                        }`}>{formatTime(slot.start_time)}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            {selectedSlot && (
              <div className="mt-6 flex justify-end">
                <button onClick={() => { 
                  setLocationInfo(prev => ({ ...prev, contactName: clientInfo.fullName, contactPhone: clientInfo.phone })); 
                  setStep('location'); 
                }}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">{t('continue')}</button>
              </div>
            )}
          </div>
        )}

        {/* Step 4: Location */}
        {step === 'location' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <button onClick={() => setStep('datetime')} className="text-blue-600 hover:text-blue-700 mb-4 flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>{t('back')}
            </button>

            <h2 className="text-xl font-semibold text-gray-900 mb-2">{t('location')}</h2>
            <p className="text-gray-600 mb-6">{t('locationDesc')}</p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('address')} *</label>
                <input type="text" value={locationInfo.address}
                  onChange={(e) => setLocationInfo(prev => ({ ...prev, address: e.target.value }))}
                  placeholder={t('enterAddress')}
                  className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-900" />
              </div>
              
              <div className="border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-3">{t('onSiteContact')}</label>
                
                <div className="flex items-center space-x-4 mb-4">
                  <label className="flex items-center cursor-pointer">
                    <input type="radio" checked={locationInfo.useClientInfo}
                      onChange={() => setLocationInfo(prev => ({ 
                        ...prev, 
                        useClientInfo: true, 
                        contactName: clientInfo.fullName, 
                        contactPhone: clientInfo.phone 
                      }))}
                      className="w-4 h-4 text-blue-600" />
                    <span className="ml-2 text-sm text-gray-700">{t('sameAsClientInfo')}</span>
                  </label>
                  
                  <label className="flex items-center cursor-pointer">
                    <input type="radio" checked={!locationInfo.useClientInfo}
                      onChange={() => setLocationInfo(prev => ({ ...prev, useClientInfo: false, contactName: '', contactPhone: '' }))}
                      className="w-4 h-4 text-blue-600" />
                    <span className="ml-2 text-sm text-gray-700">{t('customLocation')}</span>
                  </label>
                </div>
                
                {!locationInfo.useClientInfo ? (
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">{t('contactName')}</label>
                      <input type="text" value={locationInfo.contactName}
                        onChange={(e) => setLocationInfo(prev => ({ ...prev, contactName: e.target.value }))}
                        placeholder={t('enterContactName')}
                        className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-900" />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">{t('contactPhone')}</label>
                      <input type="tel" value={locationInfo.contactPhone}
                        onChange={(e) => setLocationInfo(prev => ({ ...prev, contactPhone: e.target.value }))}
                        placeholder={t('enterContactPhone')}
                        className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-900" />
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-gray-50 rounded-lg">
                    <p className="text-sm text-gray-700"><strong>{clientInfo.fullName}</strong></p>
                    <p className="text-sm text-gray-500">{clientInfo.phone}</p>
                  </div>
                )}
              </div>
            </div>
            
            <div className="mt-6 flex justify-end">
              <button onClick={() => setStep('confirm')} disabled={!locationInfo.address.trim()}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium">
                {t('continue')}
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Confirm */}
        {step === 'confirm' && selectedSlot && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <button onClick={() => setStep('location')} className="text-blue-600 hover:text-blue-700 mb-4 flex items-center">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>{t('back')}
            </button>

            <h2 className="text-xl font-semibold text-gray-900 mb-6">{t('confirmBooking')}</h2>
            
            {/* Client Summary */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <h3 className="font-medium text-gray-900 mb-2">{t('clientInfo')}</h3>
              <p className="text-gray-700">{clientInfo.fullName}</p>
              <p className="text-gray-500 text-sm">{clientInfo.email} • {clientInfo.phone}</p>
            </div>
            
            {/* Booking Summary */}
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <h3 className="font-medium text-gray-900 mb-3">{t('bookingSummary')}</h3>
              
              <div className="space-y-2 mb-4">
                {selectedServices.map(item => (
                  <div key={item.service.id} className="flex justify-between text-sm">
                    <span className="text-gray-600">{item.service.name} {item.quantity > 1 && `(x${item.quantity})`}</span>
                    <span className="text-gray-900 font-medium">{formatCurrency(item.service.price * item.quantity)}</span>
                  </div>
                ))}
              </div>
              
              <div className="border-t pt-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{t('date')}</span>
                  <span className="text-gray-900">{formatDate(selectedDate)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{t('time')}</span>
                  <span className="text-gray-900">{formatTime(selectedSlot.start_time)} - {formatTime(selectedSlot.end_time)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{t('duration')}</span>
                  <span className="text-gray-900">{formatDuration(totalDuration)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{t('location')}</span>
                  <span className="text-gray-900 text-right max-w-xs">{locationInfo.address}</span>
                </div>
                <div className="flex justify-between font-medium pt-2 border-t text-base">
                  <span className="text-gray-900">{t('total')}</span>
                  <span className="text-gray-900">{formatCurrency(totalPrice)}</span>
                </div>
              </div>
            </div>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('notes')} ({t('optional')})</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
                className="w-full p-3 border border-gray-300 rounded-lg bg-white text-gray-900"
                placeholder={t('notesPlaceholder')} />
            </div>
            
            <button onClick={handleSubmitBooking} disabled={submitting}
              className="w-full py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium text-lg">
              {submitting ? t('loading') : t('confirmBookingBtn')}
            </button>
          </div>
        )}

        {/* Success */}
        {step === 'success' && (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3">{t('bookingRequested')}</h2>
            <p className="text-gray-600 mb-8 max-w-md mx-auto">{t('bookingRequestedMsg')}</p>
            <button onClick={resetForm}
              className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
              {lang === 'fr' ? 'Nouvelle réservation' : 'Book Another Service'}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
