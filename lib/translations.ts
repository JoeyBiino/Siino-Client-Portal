// Translations for Client Portal
// Supports English and French

export type Language = 'en' | 'fr';

export const translations = {
  en: {
    // Common
    loading: 'Loading...',
    error: 'Error',
    cancel: 'Cancel',
    save: 'Save',
    confirm: 'Confirm',
    back: 'Back',
    next: 'Next',
    done: 'Done',
    close: 'Close',
    optional: 'optional',
    required: 'required',
    
    // Navigation
    dashboard: 'Dashboard',
    projects: 'Projects',
    invoices: 'Invoices',
    bookings: 'Bookings',
    signOut: 'Sign Out',
    
    // Booking Flow
    bookServices: 'Book Services',
    selectServices: 'Select Services',
    selectServicesDesc: 'Select one or more services (you can adjust quantities)',
    dateAndTime: 'Date & Time',
    selectDate: 'Select a date',
    selectTime: 'Select a time',
    location: 'Location',
    locationDesc: 'Where should we meet?',
    confirmBooking: 'Confirm Booking',
    bookingSummary: 'Booking Summary',
    
    // Services
    services: 'Services',
    service: 'Service',
    quantity: 'Quantity',
    duration: 'Duration',
    price: 'Price',
    total: 'Total',
    noServicesAvailable: 'No services available',
    servicesSelected: 'service(s) selected',
    continue: 'Continue',
    
    // Date/Time
    date: 'Date',
    time: 'Time',
    availableTimes: 'Available Times',
    noAvailableTimes: 'No available times on this date. Please select another date.',
    selectAnotherDate: 'Select another date',
    
    // Location
    address: 'Address',
    onSiteContact: 'On-site Contact',
    contactName: 'Contact Name',
    contactPhone: 'Contact Phone',
    sameAsClientInfo: 'Same as my contact info',
    customLocation: 'Different contact',
    enterAddress: 'Enter the address',
    enterContactName: 'Enter contact name',
    enterContactPhone: 'Enter contact phone',
    
    // Confirmation
    notes: 'Notes',
    notesPlaceholder: 'Any special requests or information...',
    confirmBookingBtn: 'Confirm Booking',
    bookingRequested: 'Booking Requested!',
    bookingRequestedMsg: "Your booking request has been submitted. You'll receive confirmation once it's approved.",
    
    // My Bookings
    myBookings: 'My Bookings',
    upcoming: 'Upcoming',
    past: 'Past',
    noUpcomingBookings: 'No upcoming bookings',
    noPastBookings: 'No past bookings',
    cancelBooking: 'Cancel',
    cancelBookingConfirm: 'Are you sure you want to cancel this booking?',
    bookAService: 'Book a Service',
    
    // Status
    pending: 'Pending',
    confirmed: 'Confirmed',
    completed: 'Completed',
    cancelled: 'Cancelled',
    noShow: 'No Show',
    
    // Client Info (for booking portal)
    clientInfo: 'Client Information',
    fullName: 'Full Name',
    email: 'Email',
    phone: 'Phone Number',
    billingInfo: 'Billing Information',
    billingAddress: 'Billing Address',
    city: 'City',
    province: 'Province',
    postalCode: 'Postal Code',
    alreadyAClient: 'Already a client?',
    enterPortalCode: 'Enter your portal code',
    portalCode: 'Portal Code',
    lookupClient: 'Look Up',
    newClient: 'New Client',
    
    // Steps
    step: 'Step',
    of: 'of',
  },
  
  fr: {
    // Common
    loading: 'Chargement...',
    error: 'Erreur',
    cancel: 'Annuler',
    save: 'Sauvegarder',
    confirm: 'Confirmer',
    back: 'Retour',
    next: 'Suivant',
    done: 'Terminé',
    close: 'Fermer',
    optional: 'optionnel',
    required: 'requis',
    
    // Navigation
    dashboard: 'Tableau de bord',
    projects: 'Projets',
    invoices: 'Factures',
    bookings: 'Réservations',
    signOut: 'Déconnexion',
    
    // Booking Flow
    bookServices: 'Réserver des services',
    selectServices: 'Sélectionner les services',
    selectServicesDesc: 'Sélectionnez un ou plusieurs services (vous pouvez ajuster les quantités)',
    dateAndTime: 'Date et heure',
    selectDate: 'Sélectionnez une date',
    selectTime: 'Sélectionnez une heure',
    location: 'Emplacement',
    locationDesc: 'Où devons-nous nous rencontrer?',
    confirmBooking: 'Confirmer la réservation',
    bookingSummary: 'Résumé de la réservation',
    
    // Services
    services: 'Services',
    service: 'Service',
    quantity: 'Quantité',
    duration: 'Durée',
    price: 'Prix',
    total: 'Total',
    noServicesAvailable: 'Aucun service disponible',
    servicesSelected: 'service(s) sélectionné(s)',
    continue: 'Continuer',
    
    // Date/Time
    date: 'Date',
    time: 'Heure',
    availableTimes: 'Heures disponibles',
    noAvailableTimes: 'Aucune heure disponible à cette date. Veuillez sélectionner une autre date.',
    selectAnotherDate: 'Sélectionner une autre date',
    
    // Location
    address: 'Adresse',
    onSiteContact: 'Contact sur place',
    contactName: 'Nom du contact',
    contactPhone: 'Téléphone du contact',
    sameAsClientInfo: 'Identique à mes coordonnées',
    customLocation: 'Contact différent',
    enterAddress: 'Entrez l\'adresse',
    enterContactName: 'Entrez le nom du contact',
    enterContactPhone: 'Entrez le téléphone du contact',
    
    // Confirmation
    notes: 'Notes',
    notesPlaceholder: 'Demandes spéciales ou informations...',
    confirmBookingBtn: 'Confirmer la réservation',
    bookingRequested: 'Réservation demandée!',
    bookingRequestedMsg: 'Votre demande de réservation a été soumise. Vous recevrez une confirmation une fois approuvée.',
    
    // My Bookings
    myBookings: 'Mes réservations',
    upcoming: 'À venir',
    past: 'Passées',
    noUpcomingBookings: 'Aucune réservation à venir',
    noPastBookings: 'Aucune réservation passée',
    cancelBooking: 'Annuler',
    cancelBookingConfirm: 'Êtes-vous sûr de vouloir annuler cette réservation?',
    bookAService: 'Réserver un service',
    
    // Status
    pending: 'En attente',
    confirmed: 'Confirmé',
    completed: 'Terminé',
    cancelled: 'Annulé',
    noShow: 'Absent',
    
    // Client Info (for booking portal)
    clientInfo: 'Informations client',
    fullName: 'Nom complet',
    email: 'Courriel',
    phone: 'Numéro de téléphone',
    billingInfo: 'Informations de facturation',
    billingAddress: 'Adresse de facturation',
    city: 'Ville',
    province: 'Province',
    postalCode: 'Code postal',
    alreadyAClient: 'Déjà client?',
    enterPortalCode: 'Entrez votre code portail',
    portalCode: 'Code portail',
    lookupClient: 'Rechercher',
    newClient: 'Nouveau client',
    
    // Steps
    step: 'Étape',
    of: 'de',
  }
};

export function getTranslation(lang: Language, key: keyof typeof translations.en): string {
  return translations[lang][key] || translations.en[key] || key;
}

export function useTranslations(lang: Language) {
  return {
    t: (key: keyof typeof translations.en) => getTranslation(lang, key),
    lang,
  };
}
