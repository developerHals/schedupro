export const sortRooms = (rooms) => {
  if (!rooms) return [];
  
  return [...rooms].sort((a, b) => {
    const nameA = a.room_number || '';
    const nameB = b.room_number || '';
    
    // Standard room pattern: "Room X" or just "X"
    // We'll treat "Room X" and "X" as standard numeric rooms
    const getRoomNumber = (name) => {
      const match = name.match(/^(?:Room\s+)?(\d+)$/i);
      return match ? parseInt(match[1], 10) : null;
    };

    const numA = getRoomNumber(nameA);
    const numB = getRoomNumber(nameB);

    // If both are numeric rooms, sort by number
    if (numA !== null && numB !== null) {
      return numA - numB;
    }

    // If A is numeric and B is not, A comes first
    if (numA !== null && numB === null) {
      return -1;
    }

    // If B is numeric and A is not, B comes first
    if (numA === null && numB !== null) {
      return 1;
    }

    // If neither is numeric, sort alphabetically
    return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
  });
};
