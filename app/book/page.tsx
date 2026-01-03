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

const getSupabaseConfig = () => {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  return {
    SUPABASE_URL: baseUrl ? `${baseUrl}/functions/v1` : '',
    SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    DEFAULT_TEAM_ID: process.env.NEXT_PUBLIC_TEAM_ID || '',
  };
};

export default function PublicBookingPage() {
  const { SUPABASE_URL, SUPABASE_ANON_KEY, DEFAULT_TEAM_ID } = getSupabaseConfig();
  const [lang, setLang] = useState<Language>('en');
  const t = (key: keyof typeof translations.en) => translations[lang][key] || key;
  
  const [step, setStep] = useState<BookingStep>('client-info');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [teamId, setTeamId] = useState<string>('');
  
  const [clientInfo, setClientInfo] = useState<ClientInfo>({
    fullName: '', email: '', phone: '', billingAddress: '', billingCity: '', billingProvince: 'QC', billingPostalCode: '',
  });
  const [isExistingClient, setIsExistingClient] = useState(false);
  const [portalCode, setPortalCode] = useState('');
  const [lookingUpClient, setLookingUpClient] = useState(false);
  const [clientVerified, setClientVerified] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [selectedServices, setSelectedServices] = useState<SelectedService[]>([]);
  
  const [selectedDate, setSelectedDate] = useState('');
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  
  const [locationInfo, setLocationInfo] = useState<LocationInfo>({
    address: '', contactName: '', contactPhone: '', useClientInfo: true,
  });
  
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const savedLang = localStorage.getItem('booking_language') as Language;
    if (savedLang && (savedLang === 'en' || savedLang === 'fr')) setLang(savedLang);
    const params = new URLSearchParams(window.location.search);
    const urlTeamId = params.get('team');
    setTeamId(urlTeamId || DEFAULT_TEAM_ID);
  }, [DEFAULT_TEAM_ID]);

  const handleLanguageChange = (newLang: Language) => {
    setLang(newLang);
    localStorage.setItem('booking_language', newLang);
  };

  const loadServices = async () => {
    if (!teamId) { setError('Team ID is required. Add ?team=YOUR_TEAM_ID to the URL'); return; }
    try {
      setLoading(true); setError('');
      const response = await fetch(`${SUPABASE_URL}/public-services?team_id=${teamId}`, {
        method: 'GET', headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
      });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error || 'Failed to load services'); }
      const data = await response.json();
      setServices(data.services || []); setCategories(data.categories || []);
    } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  };

  const handleLookupClient = async () => {
    if (!portalCode.trim()) return;
    setLookingUpClient(true); setError('');
    try {
      const response = await fetch(`${SUPABASE_URL}/portal-lookup-client`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ portal_code: portalCode.trim() }),
      });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error || 'Client not found'); }
      const data = await response.json();
      setClientInfo({
        fullName: data.client.name || '', email: data.client.email || '', phone: data.client.phone || '',
        billingAddress: data.client.billing_address || '', billingCity: data.client.billing_city || '',
        billingProvince: data.client.billing_province || 'QC', billingPostalCode: data.client.billing_postal_code || '',
      });
      setClientId(data.client.id); setClientVerified(true);
    } catch (err: any) { setError(err.message); } finally { setLookingUpClient(false); }
  };

  const loadSlots = async (date: string) => {
    if (selectedServices.length === 0) return;
    setLoadingSlots(true);
    try {
      const tzOffset = new Date().getTimezoneOffset();
      const response = await fetch(
        `${SUPABASE_URL}/public-available-slots?service_id=${selectedServices[0].service.id}&date=${date}&team_id=${teamId}&tz_offset=${tzOffset}`,
        { method: 'GET', headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' } }
      );
      if (!response.ok) throw new Error('Failed to load slots');
      const data = await response.json();
      const totalDur = selectedServices.reduce((sum, item) => sum + (item.service.duration_minutes * item.quantity), 0);
      const filteredSlots = (data.slots || []).filter((slot: TimeSlot) => {
        const slotStart = new Date(slot.start_time);
        const neededEnd = new Date(slotStart.getTime() + totalDur * 60 * 1000);
        const dayEnd = new Date(slotStart); dayEnd.setHours(23, 59, 59);
        return neededEnd <= dayEnd;
      });
      setAvailableSlots(filteredSlots);
    } catch (err: any) { setError(err.message); setAvailableSlots([]); } finally { setLoadingSlots(false); }
  };

  const handleSubmitBooking = async () => {
    if (selectedServices.length === 0 || !selectedSlot) return;
    try {
      setSubmitting(true);
      const totalDur = selectedServices.reduce((sum, item) => sum + (item.service.duration_minutes * item.quantity), 0);
      const serviceNames = selectedServices.map(s => s.quantity > 1 ? `${s.service.name} (x${s.quantity})` : s.service.name).join(', ');
      let bookingNotes = `Services: ${serviceNames}\nDuration: ${formatDuration(totalDur)}\nLocation: ${locationInfo.address}\nContact: ${locationInfo.useClientInfo ? clientInfo.fullName : locationInfo.contactName} - ${locationInfo.useClientInfo ? clientInfo.phone : locationInfo.contactPhone}\n`;
      if (notes) bookingNotes += `\nNotes: ${notes}`;
      const response = await fetch(`${SUPABASE_URL}/portal-public-booking`, {
        method: 'POST', headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          client_info: !clientId ? { name: clientInfo.fullName, email: clientInfo.email, phone: clientInfo.phone, billing_address: clientInfo.billingAddress, billing_city: clientInfo.billingCity, billing_province: clientInfo.billingProvince, billing_postal_code: clientInfo.billingPostalCode } : undefined,
          service_id: selectedServices[0].service.id, start_time: selectedSlot.start_time, end_time: selectedSlot.end_time, notes: bookingNotes,
          location_address: locationInfo.address, location_contact_name: locationInfo.useClientInfo ? clientInfo.fullName : locationInfo.contactName, location_contact_phone: locationInfo.useClientInfo ? clientInfo.phone : locationInfo.contactPhone,
        }),
      });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error || 'Failed to create booking'); }
      setStep('success');
    } catch (err: any) { setError(err.message); } finally { setSubmitting(false); }
  };

  const formatCurrency = (amount: number) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(amount);
  const formatDuration = (minutes: number) => {
    if (minutes === 0) return lang === 'fr' ? 'Aucune durée' : 'No duration';
    const hours = Math.floor(minutes / 60); const mins = minutes % 60;
    if (hours === 0) return `${mins} min`; if (mins === 0) return `${hours}h`; return `${hours}h ${mins}min`;
  };
  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const formatTime = (isoString: string) => new Date(isoString).toLocaleTimeString(lang === 'fr' ? 'fr-CA' : 'en-CA', { hour: '2-digit', minute: '2-digit' });

  const totalDuration = selectedServices.reduce((sum, item) => sum + (item.service.duration_minutes * item.quantity), 0);
  const totalPrice = selectedServices.reduce((sum, item) => sum + (item.service.price * item.quantity), 0);
  const maxLeadTimeHours = selectedServices.length > 0 ? Math.max(...selectedServices.map(s => s.service.lead_time_hours)) : 24;
  const minMaxAdvanceDays = selectedServices.length > 0 ? Math.min(...selectedServices.map(s => s.service.max_advance_days)) : 90;

  const getMinDate = () => { const today = new Date(); today.setHours(today.getHours() + maxLeadTimeHours); return today.toISOString().split('T')[0]; };
  const getMaxDate = () => { const maxDate = new Date(); maxDate.setDate(maxDate.getDate() + minMaxAdvanceDays); return maxDate.toISOString().split('T')[0]; };

  const handleToggleService = (service: Service) => {
    setSelectedServices(prev => {
      const existing = prev.find(s => s.service.id === service.id);
      if (existing) return prev.filter(s => s.service.id !== service.id);
      return [...prev, { service, quantity: 1 }];
    });
  };
  const handleUpdateQuantity = (serviceId: string, delta: number) => {
    setSelectedServices(prev => prev.map(item => item.service.id === serviceId ? { ...item, quantity: Math.max(1, item.quantity + delta) } : item));
  };
  const handleSelectDate = async (date: string) => { setSelectedDate(date); setSelectedSlot(null); await loadSlots(date); };
  const handleSelectSlot = (slot: TimeSlot) => {
    const startTime = new Date(slot.start_time);
    const endTime = new Date(startTime.getTime() + totalDuration * 60 * 1000);
    setSelectedSlot({ ...slot, end_time: endTime.toISOString() });
  };
  const isClientInfoValid = () => clientInfo.fullName.trim() && clientInfo.email.trim() && clientInfo.phone.trim() && clientInfo.billingAddress.trim() && clientInfo.billingCity.trim() && clientInfo.billingPostalCode.trim();
  const resetForm = () => {
    setStep('client-info'); setClientInfo({ fullName: '', email: '', phone: '', billingAddress: '', billingCity: '', billingProvince: 'QC', billingPostalCode: '' });
    setIsExistingClient(false); setPortalCode(''); setClientVerified(false); setClientId(null); setSelectedServices([]); setSelectedDate(''); setAvailableSlots([]); setSelectedSlot(null);
    setLocationInfo({ address: '', contactName: '', contactPhone: '', useClientInfo: true }); setNotes('');
  };

  const steps = [t('clientInfo'), t('services'), t('dateAndTime'), t('location'), t('confirm')];
  const stepKeys: BookingStep[] = ['client-info', 'services', 'datetime', 'location', 'confirm'];
  const currentStepIndex = stepKeys.indexOf(step);

  const ProgressSteps = () => (
    <div className="w-full mb-8">
      <div className="flex items-center justify-between">
        {steps.map((label, index) => (
          <div key={label} className="flex items-center flex-1 last:flex-initial">
            <div className="flex flex-col items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${index < currentStepIndex ? 'bg-[#9B7EBF] text-white' : index === currentStepIndex ? 'bg-[#9B7EBF] text-white ring-4 ring-[#9B7EBF]/30' : 'bg-[#2a2a32] text-gray-400'}`}>
                {index < currentStepIndex ? (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>) : (index + 1)}
              </div>
              <span className={`mt-2 text-xs font-medium hidden sm:block ${index === currentStepIndex ? 'text-white' : 'text-gray-500'}`}>{label}</span>
            </div>
            {index < steps.length - 1 && (<div className={`flex-1 h-0.5 mx-2 sm:mx-4 ${index < currentStepIndex ? 'bg-[#9B7EBF]' : 'bg-[#2a2a32]'}`} />)}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0d0d10]">
      <header className="bg-[#1a1a1e] border-b border-[#2a2a32] sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">{t('bookServices')}</h1>
          <div className="flex items-center gap-1">
            <button onClick={() => handleLanguageChange('en')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${lang === 'en' ? 'bg-[#9B7EBF] text-white' : 'text-gray-400 hover:text-white hover:bg-[#2a2a32]'}`}>EN</button>
            <button onClick={() => handleLanguageChange('fr')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${lang === 'fr' ? 'bg-[#9B7EBF] text-white' : 'text-gray-400 hover:text-white hover:bg-[#2a2a32]'}`}>FR</button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {step !== 'success' && <ProgressSteps />}
        {error && (<div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl"><p className="text-red-400">{error}</p><button onClick={() => setError('')} className="text-red-300 text-sm underline mt-1 hover:text-red-200">{t('close')}</button></div>)}

        {step === 'client-info' && (
          <div className="bg-[#1a1a1e] rounded-xl border border-[#2a2a32] p-6">
            <h2 className="text-xl font-semibold text-white mb-6">{t('clientInfo')}</h2>
            <div className="mb-6 p-4 bg-[#16161a] rounded-xl border border-[#1e1e24]">
              <div className="flex items-center justify-between mb-4">
                <span className="font-medium text-white">{t('alreadyAClient')}</span>
                <button onClick={() => { setIsExistingClient(!isExistingClient); setClientVerified(false); }} className={`px-4 py-2 rounded-lg font-medium transition-colors ${isExistingClient ? 'bg-[#9B7EBF] text-white' : 'bg-[#2a2a32] text-gray-300 hover:bg-[#2a2a32]/80'}`}>{isExistingClient ? t('newClient') : t('alreadyAClient')}</button>
              </div>
              {isExistingClient && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-400">{t('enterPortalCode')}</p>
                  <div className="flex gap-2">
                    <input type="text" value={portalCode} onChange={(e) => setPortalCode(e.target.value.toUpperCase())} placeholder={t('portalCode')} className="flex-1 p-3 bg-[#0d0d10] border border-[#2a2a32] rounded-lg text-white placeholder-gray-500 uppercase focus:ring-2 focus:ring-[#9B7EBF] focus:border-transparent" maxLength={8} />
                    <button onClick={handleLookupClient} disabled={lookingUpClient || !portalCode.trim()} className="px-6 py-3 bg-[#9B7EBF] text-white rounded-lg hover:bg-[#8a6dae] disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors">{lookingUpClient ? '...' : t('lookupClient')}</button>
                  </div>
                  {clientVerified && (<div className="flex items-center text-green-400"><svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg><span className="text-sm font-medium">{lang === 'fr' ? 'Client vérifié!' : 'Client verified!'}</span></div>)}
                </div>
              )}
            </div>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-300 mb-2">{t('fullName')} *</label><input type="text" value={clientInfo.fullName} onChange={(e) => setClientInfo(prev => ({ ...prev, fullName: e.target.value }))} className="w-full p-3 bg-[#0d0d10] border border-[#2a2a32] rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-[#9B7EBF] focus:border-transparent disabled:opacity-50" disabled={clientVerified} /></div>
              <div className="grid md:grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-gray-300 mb-2">{t('email')} *</label><input type="email" value={clientInfo.email} onChange={(e) => setClientInfo(prev => ({ ...prev, email: e.target.value }))} className="w-full p-3 bg-[#0d0d10] border border-[#2a2a32] rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-[#9B7EBF] focus:border-transparent disabled:opacity-50" disabled={clientVerified} /></div>
                <div><label className="block text-sm font-medium text-gray-300 mb-2">{t('phone')} *</label><input type="tel" value={clientInfo.phone} onChange={(e) => setClientInfo(prev => ({ ...prev, phone: e.target.value }))} className="w-full p-3 bg-[#0d0d10] border border-[#2a2a32] rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-[#9B7EBF] focus:border-transparent disabled:opacity-50" disabled={clientVerified} /></div>
              </div>
              <div className="border-t border-[#2a2a32] pt-4 mt-4">
                <h3 className="font-medium text-white mb-3">{t('billingInfo')}</h3>
                <div className="space-y-4">
                  <div><label className="block text-sm font-medium text-gray-300 mb-2">{t('billingAddress')} *</label><input type="text" value={clientInfo.billingAddress} onChange={(e) => setClientInfo(prev => ({ ...prev, billingAddress: e.target.value }))} className="w-full p-3 bg-[#0d0d10] border border-[#2a2a32] rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-[#9B7EBF] focus:border-transparent disabled:opacity-50" disabled={clientVerified} /></div>
                  <div className="grid md:grid-cols-3 gap-4">
                    <div><label className="block text-sm font-medium text-gray-300 mb-2">{t('city')} *</label><input type="text" value={clientInfo.billingCity} onChange={(e) => setClientInfo(prev => ({ ...prev, billingCity: e.target.value }))} className="w-full p-3 bg-[#0d0d10] border border-[#2a2a32] rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-[#9B7EBF] focus:border-transparent disabled:opacity-50" disabled={clientVerified} /></div>
                    <div><label className="block text-sm font-medium text-gray-300 mb-2">{t('province')}</label><select value={clientInfo.billingProvince} onChange={(e) => setClientInfo(prev => ({ ...prev, billingProvince: e.target.value }))} className="w-full p-3 bg-[#0d0d10] border border-[#2a2a32] rounded-lg text-white focus:ring-2 focus:ring-[#9B7EBF] focus:border-transparent disabled:opacity-50" disabled={clientVerified}><option value="QC">Québec</option><option value="ON">Ontario</option><option value="BC">British Columbia</option><option value="AB">Alberta</option><option value="MB">Manitoba</option><option value="SK">Saskatchewan</option><option value="NS">Nova Scotia</option><option value="NB">New Brunswick</option><option value="NL">Newfoundland and Labrador</option><option value="PE">Prince Edward Island</option><option value="NT">Northwest Territories</option><option value="YT">Yukon</option><option value="NU">Nunavut</option></select></div>
                    <div><label className="block text-sm font-medium text-gray-300 mb-2">{t('postalCode')} *</label><input type="text" value={clientInfo.billingPostalCode} onChange={(e) => setClientInfo(prev => ({ ...prev, billingPostalCode: e.target.value.toUpperCase() }))} placeholder="H1A 1A1" className="w-full p-3 bg-[#0d0d10] border border-[#2a2a32] rounded-lg text-white placeholder-gray-500 uppercase focus:ring-2 focus:ring-[#9B7EBF] focus:border-transparent disabled:opacity-50" maxLength={7} disabled={clientVerified} /></div>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end"><button onClick={() => { loadServices(); setStep('services'); }} disabled={!isClientInfoValid()} className="px-8 py-3 bg-[#9B7EBF] text-white rounded-lg hover:bg-[#8a6dae] disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors">{t('continue')}</button></div>
          </div>
        )}

        {step === 'services' && (
          <div className="bg-[#1a1a1e] rounded-xl border border-[#2a2a32] p-6">
            <button onClick={() => setStep('client-info')} className="text-[#9B7EBF] hover:text-[#b599d0] mb-4 flex items-center transition-colors"><svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>{t('back')}</button>
            <h2 className="text-xl font-semibold text-white mb-2">{t('selectServices')}</h2>
            <p className="text-gray-400 mb-6">{t('selectServicesDesc')}</p>
            {loading ? (<div className="flex items-center justify-center py-12"><div className="w-8 h-8 border-2 border-[#9B7EBF] border-t-transparent rounded-full animate-spin"></div></div>) : (
              <>
                {categories.map(category => {
                  const categoryServices = services.filter(s => s.category_id === category.id);
                  if (categoryServices.length === 0) return null;
                  return (
                    <div key={category.id} className="mb-6">
                      <h3 className="text-lg font-medium text-white mb-3">{category.name}</h3>
                      <div className="space-y-3">
                        {categoryServices.map(service => {
                          const selected = selectedServices.find(s => s.service.id === service.id);
                          const isSelected = !!selected;
                          return (
                            <div key={service.id} className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${isSelected ? 'border-[#9B7EBF] bg-[#9B7EBF]/10' : 'border-[#2a2a32] hover:border-[#9B7EBF]/50 bg-[#16161a]'}`} onClick={() => handleToggleService(service)}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center flex-1">
                                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center mr-3 transition-colors ${isSelected ? 'bg-[#9B7EBF] border-[#9B7EBF]' : 'border-gray-500'}`}>{isSelected && (<svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>)}</div>
                                  <div><h4 className="font-medium text-white">{service.name}</h4>{service.description && <p className="text-sm text-gray-400">{service.description}</p>}</div>
                                </div>
                                <div className="text-right ml-4"><div className="font-semibold text-white">{formatCurrency(service.price)}</div><div className="text-sm text-gray-400">{formatDuration(service.duration_minutes)}</div></div>
                              </div>
                              {isSelected && (<div className="mt-4 pt-4 border-t border-[#2a2a32] flex items-center justify-end gap-3" onClick={e => e.stopPropagation()}><span className="text-sm text-gray-400">{t('quantity')}:</span><button onClick={() => handleUpdateQuantity(service.id, -1)} className="w-8 h-8 rounded-lg bg-[#2a2a32] flex items-center justify-center hover:bg-[#2a2a32]/80 text-white font-medium transition-colors" disabled={selected?.quantity === 1}>−</button><span className="font-medium w-8 text-center text-white">{selected?.quantity || 1}</span><button onClick={() => handleUpdateQuantity(service.id, 1)} className="w-8 h-8 rounded-lg bg-[#2a2a32] flex items-center justify-center hover:bg-[#2a2a32]/80 text-white font-medium transition-colors">+</button></div>)}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                {selectedServices.length > 0 && (<div className="sticky bottom-0 bg-[#1a1a1e] border-t border-[#2a2a32] pt-4 mt-6 -mx-6 px-6 pb-6 -mb-6"><div className="flex items-center justify-between"><div><p className="text-sm text-gray-400">{selectedServices.length} {t('servicesSelected')}</p><p className="font-semibold text-white">{t('total')}: {formatCurrency(totalPrice)} • {formatDuration(totalDuration)}</p></div><button onClick={() => setStep('datetime')} className="px-8 py-3 bg-[#9B7EBF] text-white rounded-lg hover:bg-[#8a6dae] font-medium transition-colors">{t('continue')}</button></div></div>)}
              </>
            )}
          </div>
        )}

        {step === 'datetime' && (
          <div className="bg-[#1a1a1e] rounded-xl border border-[#2a2a32] p-6">
            <button onClick={() => setStep('services')} className="text-[#9B7EBF] hover:text-[#b599d0] mb-4 flex items-center transition-colors"><svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>{t('back')}</button>
            <h2 className="text-xl font-semibold text-white mb-6">{t('dateAndTime')}</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div><label className="block text-sm font-medium text-gray-300 mb-2">{t('selectDate')}</label><input type="date" min={getMinDate()} max={getMaxDate()} value={selectedDate} onChange={(e) => handleSelectDate(e.target.value)} className="w-full p-3 bg-[#0d0d10] border border-[#2a2a32] rounded-lg text-white focus:ring-2 focus:ring-[#9B7EBF] focus:border-transparent [color-scheme:dark]" /></div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">{t('selectTime')}</label>
                {!selectedDate ? (<div className="p-4 border-2 border-dashed border-[#2a2a32] rounded-lg text-center"><p className="text-gray-500 text-sm">{t('selectDate')}</p></div>) : loadingSlots ? (<div className="flex items-center justify-center p-8"><div className="w-6 h-6 border-2 border-[#9B7EBF] border-t-transparent rounded-full animate-spin"></div></div>) : availableSlots.length === 0 ? (<div className="p-4 border-2 border-dashed border-[#2a2a32] rounded-lg text-center"><p className="text-gray-500 text-sm">{t('noAvailableTimes')}</p></div>) : (
                  <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto p-1">
                    {availableSlots.map((slot, index) => (<button key={index} onClick={() => handleSelectSlot(slot)} className={`p-3 text-center rounded-lg font-medium transition-all ${selectedSlot?.start_time === slot.start_time ? 'bg-[#9B7EBF] text-white border-2 border-[#b599d0]' : 'bg-[#16161a] text-gray-300 border-2 border-[#2a2a32] hover:border-[#9B7EBF]/50 hover:text-white'}`}>{formatTime(slot.start_time)}</button>))}
                  </div>
                )}
              </div>
            </div>
            {selectedSlot && (<div className="mt-6 flex justify-end"><button onClick={() => { setLocationInfo(prev => ({ ...prev, contactName: clientInfo.fullName, contactPhone: clientInfo.phone })); setStep('location'); }} className="px-8 py-3 bg-[#9B7EBF] text-white rounded-lg hover:bg-[#8a6dae] font-medium transition-colors">{t('continue')}</button></div>)}
          </div>
        )}

        {step === 'location' && (
          <div className="bg-[#1a1a1e] rounded-xl border border-[#2a2a32] p-6">
            <button onClick={() => setStep('datetime')} className="text-[#9B7EBF] hover:text-[#b599d0] mb-4 flex items-center transition-colors"><svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>{t('back')}</button>
            <h2 className="text-xl font-semibold text-white mb-6">{t('location')}</h2>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium text-gray-300 mb-2">{t('address')} *</label><input type="text" value={locationInfo.address} onChange={(e) => setLocationInfo(prev => ({ ...prev, address: e.target.value }))} placeholder={t('enterAddress')} className="w-full p-3 bg-[#0d0d10] border border-[#2a2a32] rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-[#9B7EBF] focus:border-transparent" /></div>
              <div className="border-t border-[#2a2a32] pt-4">
                <label className="block text-sm font-medium text-gray-300 mb-3">{t('onSiteContact')}</label>
                <div className="flex items-center gap-4 mb-4">
                  <label className="flex items-center cursor-pointer"><input type="radio" checked={locationInfo.useClientInfo} onChange={() => setLocationInfo(prev => ({ ...prev, useClientInfo: true, contactName: clientInfo.fullName, contactPhone: clientInfo.phone }))} className="w-4 h-4 text-[#9B7EBF] border-gray-500 focus:ring-[#9B7EBF]" /><span className="ml-2 text-sm text-gray-300">{t('sameAsClientInfo')}</span></label>
                  <label className="flex items-center cursor-pointer"><input type="radio" checked={!locationInfo.useClientInfo} onChange={() => setLocationInfo(prev => ({ ...prev, useClientInfo: false, contactName: '', contactPhone: '' }))} className="w-4 h-4 text-[#9B7EBF] border-gray-500 focus:ring-[#9B7EBF]" /><span className="ml-2 text-sm text-gray-300">{t('customLocation')}</span></label>
                </div>
                {!locationInfo.useClientInfo ? (<div className="grid md:grid-cols-2 gap-4"><div><label className="block text-sm text-gray-400 mb-1">{t('contactName')}</label><input type="text" value={locationInfo.contactName} onChange={(e) => setLocationInfo(prev => ({ ...prev, contactName: e.target.value }))} placeholder={t('enterContactName')} className="w-full p-3 bg-[#0d0d10] border border-[#2a2a32] rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-[#9B7EBF] focus:border-transparent" /></div><div><label className="block text-sm text-gray-400 mb-1">{t('contactPhone')}</label><input type="tel" value={locationInfo.contactPhone} onChange={(e) => setLocationInfo(prev => ({ ...prev, contactPhone: e.target.value }))} placeholder={t('enterContactPhone')} className="w-full p-3 bg-[#0d0d10] border border-[#2a2a32] rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-[#9B7EBF] focus:border-transparent" /></div></div>) : (<div className="p-3 bg-[#16161a] rounded-lg border border-[#1e1e24]"><p className="text-sm text-white font-medium">{clientInfo.fullName}</p><p className="text-sm text-gray-400">{clientInfo.phone}</p></div>)}
              </div>
            </div>
            <div className="mt-6 flex justify-end"><button onClick={() => setStep('confirm')} disabled={!locationInfo.address.trim()} className="px-8 py-3 bg-[#9B7EBF] text-white rounded-lg hover:bg-[#8a6dae] disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors">{t('continue')}</button></div>
          </div>
        )}

        {step === 'confirm' && selectedSlot && (
          <div className="bg-[#1a1a1e] rounded-xl border border-[#2a2a32] p-6">
            <button onClick={() => setStep('location')} className="text-[#9B7EBF] hover:text-[#b599d0] mb-4 flex items-center transition-colors"><svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>{t('back')}</button>
            <h2 className="text-xl font-semibold text-white mb-6">{t('confirmBooking')}</h2>
            <div className="bg-[#16161a] rounded-xl p-4 mb-4 border border-[#1e1e24]"><h3 className="font-medium text-white mb-2">{t('clientInfo')}</h3><p className="text-gray-300">{clientInfo.fullName}</p><p className="text-gray-400 text-sm">{clientInfo.email} • {clientInfo.phone}</p></div>
            <div className="bg-[#16161a] rounded-xl p-4 mb-4 border border-[#1e1e24]">
              <h3 className="font-medium text-white mb-3">{t('bookingSummary')}</h3>
              <div className="space-y-2 mb-4">{selectedServices.map(item => (<div key={item.service.id} className="flex justify-between text-sm"><span className="text-gray-400">{item.service.name} {item.quantity > 1 && `(x${item.quantity})`}</span><span className="text-white font-medium">{formatCurrency(item.service.price * item.quantity)}</span></div>))}</div>
              <div className="border-t border-[#2a2a32] pt-3 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-gray-400">{t('date')}</span><span className="text-white">{formatDate(selectedDate)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-400">{t('time')}</span><span className="text-white">{formatTime(selectedSlot.start_time)} - {formatTime(selectedSlot.end_time)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-400">{t('duration')}</span><span className="text-white">{formatDuration(totalDuration)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-400">{t('location')}</span><span className="text-white text-right max-w-xs">{locationInfo.address}</span></div>
                <div className="flex justify-between font-semibold pt-2 border-t border-[#2a2a32] text-base"><span className="text-white">{t('total')}</span><span className="text-[#9B7EBF]">{formatCurrency(totalPrice)}</span></div>
              </div>
            </div>
            <div className="mb-6"><label className="block text-sm font-medium text-gray-300 mb-2">{t('notes')} ({t('optional')})</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full p-3 bg-[#0d0d10] border border-[#2a2a32] rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-[#9B7EBF] focus:border-transparent" placeholder={t('notesPlaceholder')} /></div>
            <button onClick={handleSubmitBooking} disabled={submitting} className="w-full py-4 bg-[#9B7EBF] text-white rounded-xl hover:bg-[#8a6dae] disabled:opacity-50 font-semibold text-lg transition-colors">{submitting ? t('loading') : t('confirmBookingBtn')}</button>
          </div>
        )}

        {step === 'success' && (
          <div className="bg-[#1a1a1e] rounded-xl border border-[#2a2a32] p-8 text-center">
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6"><svg className="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></div>
            <h2 className="text-2xl font-bold text-white mb-3">{t('bookingRequested')}</h2>
            <p className="text-gray-400 mb-8 max-w-md mx-auto">{t('bookingRequestedMsg')}</p>
            <button onClick={resetForm} className="px-8 py-3 bg-[#9B7EBF] text-white rounded-lg hover:bg-[#8a6dae] font-medium transition-colors">{lang === 'fr' ? 'Nouvelle réservation' : 'Book Another Service'}</button>
          </div>
        )}
      </main>
    </div>
  );
}
