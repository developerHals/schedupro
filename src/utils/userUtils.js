export const getUserDetails = (userOrProfile) => {
    // Handle both Auth User object and Profile object
    const email = userOrProfile.email || '';
    const name = userOrProfile.full_name || userOrProfile.user_metadata?.full_name || ''; 
    
    // Superuser Override
    if (email.toLowerCase() === 'development@haringeylearns.ac.uk') {
        return { name: 'Jay', initials: 'GJ' };
    }
    
    // Iona Override
    if (email.toLowerCase().includes('iona.oakley')) {
         return { name: 'Iona', initials: 'IO' };
    }

    // Standard Logic: Initials from Email (first.last@...)
    const localPart = email.split('@')[0];
    const parts = localPart.split('.');
    
    let initials = '';
    if (parts.length >= 1 && parts[0]) initials += parts[0][0].toUpperCase();
    if (parts.length >= 2 && parts[1]) initials += parts[1][0].toUpperCase();
    
    // If name is missing, try to format from email
    let derivedName = name;
    if (!derivedName) {
        derivedName = parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
    }

    return { name: derivedName, initials };
};
