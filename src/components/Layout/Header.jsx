import React, { useEffect, useRef, useState } from 'react';
import { 
  FiMenu, FiX, FiCalendar, FiSettings, FiUsers, FiUser,
  FiDatabase, FiShare2, FiChevronLeft, FiChevronRight, FiGrid, FiPlus, FiSmartphone,
  FiLogOut, FiLogIn, FiBook, FiLayout, FiList, FiCheckSquare, FiTrash2, FiSearch, FiPieChart, FiDollarSign, FiBell, FiMapPin, FiAward
} from 'react-icons/fi';
import { useAuth } from '../../contexts/AuthContext';
import { dataService } from '../../lib/dataService';
import { format, addDays, subDays } from 'date-fns';
import { toast } from 'react-hot-toast';
import QRCodeModal from '../Modals/QRCodeModal';
import SettingsModal from '../Modals/SettingsModal';
import SafeIcon from '../../common/SafeIcon';

const MenuButton = ({ onClick, icon: Icon, title, subtitle, variant = 'blue', hasAlert = false }) => {
  const baseClasses = "flex items-center p-3 rounded-xl transition-colors group w-full";
  const variantClasses = variant === 'red' 
    ? "bg-gray-50 hover:bg-red-50" 
    : "bg-gray-50 hover:bg-blue-50";
  
  const iconBaseClasses = "bg-white p-2.5 rounded-lg shadow-sm mr-3 transition-colors relative";
  const iconColorClasses = variant === 'red' || hasAlert
    ? "group-hover:text-red-600"
    : "group-hover:text-blue-600";

  return (
    <button
      onClick={onClick}
      className={`${baseClasses} ${variantClasses}`}
    >
      <div className={`${iconBaseClasses} ${iconColorClasses}`}>
        <SafeIcon icon={Icon} className="h-4 w-4" />
        {hasAlert && (
          <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-500 rounded-full animate-pulse" />
        )}
      </div>
      <div className="text-left">
        <p className="text-sm font-bold text-gray-900">{title}</p>
        <p className="text-[10px] text-gray-500 font-medium">{subtitle}</p>
      </div>
    </button>
  );
};

const Header = ({ selectedDate, setSelectedDate, onViewChange, currentView, onBookRoom, onRequestBooking, onLogout, onNewCourse }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [urgentPendingCount, setUrgentPendingCount] = useState(0);
  const { isSuperuser, isCM, user } = useAuth();
  const headerRef = useRef(null);

  useEffect(() => {
    const headerEl = headerRef.current;
    if (!headerEl) return;

    const updateHeaderHeightVar = () => {
      const height = headerEl.getBoundingClientRect().height;
      document.documentElement.style.setProperty('--app-header-height', `${Math.ceil(height)}px`);
    };

    updateHeaderHeightVar();

    if (typeof ResizeObserver !== 'undefined') {
      const resizeObserver = new ResizeObserver(updateHeaderHeightVar);
      resizeObserver.observe(headerEl);
      return () => resizeObserver.disconnect();
    }

    window.addEventListener('resize', updateHeaderHeightVar);
    return () => window.removeEventListener('resize', updateHeaderHeightVar);
  }, []);

  // Query for urgent pending courses (Pending status with start date <= today)
  useEffect(() => {
    const fetchUrgentPending = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const { count, error } = await dataService
          .from('Courses')
          .select('*', { count: 'exact', head: true })
          .ilike('Status', 'pending')
          .lte('Start date', today);
        
        if (error) throw error;
        setUrgentPendingCount(count || 0);
      } catch (err) {
        console.error('Error fetching urgent pending courses:', err);
      }
    };

    fetchUrgentPending();
    // Refresh every 5 minutes
    const interval = setInterval(fetchUrgentPending, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy:', err);
      toast.error('Failed to copy link');
    }
  };

  const handleDateChange = (e) => {
    setSelectedDate(new Date(e.target.value));
  };

  const navigateDate = (direction) => {
    setSelectedDate(prev => direction === 'next' ? addDays(prev, 1) : subDays(prev, 1));
  };

  const renderSuperuserMenu = () => (
    <>
      <button
        onClick={() => { onRequestBooking?.(); setMenuOpen(false); }}
        className="flex items-center p-3 rounded-xl transition-colors group w-full bg-red-50 hover:bg-red-100 mb-1"
      >
        <div className="bg-white p-2.5 rounded-lg shadow-sm mr-3 text-red-600">
          <SafeIcon icon={FiCalendar} className="h-4 w-4" />
        </div>
        <div className="text-left">
          <p className="text-sm font-bold text-red-700">Request a Booking</p>
          <p className="text-[10px] text-red-500 font-medium">Submit an external room request</p>
        </div>
      </button>

      <MenuButton
        onClick={() => { setShowQRModal(true); setMenuOpen(false); }}
        icon={FiSmartphone}
        title="QR Access"
        subtitle="Scan for mobile view"
      />


      <MenuButton
        onClick={() => { onViewChange('term-dates'); setMenuOpen(false); }}
        icon={FiCalendar}
        title="Terms dates"
        subtitle="View and copy dates"
      />
      <MenuButton
        onClick={() => { window.open('https://lbharingey.sharepoint.com/sites/haringeylearns/Shared%20Documents/Forms/AllItems.aspx', '_blank'); setMenuOpen(false); }}
        icon={FiShare2}
        title="Corp drive"
        subtitle="Open SharePoint documents"
      />
      <MenuButton
        onClick={() => { window.open('https://lbharingey.sharepoint.com/:x:/r/sites/haringeylearns/Shared%20Documents/HL%20Service%20file/HL%20Curriculum%20%26%20Quality/HL%20Curriculum%20Planning/Curriculum%20Planning.xlsx?d=w41e82f297d8a45cea090df4859adbc6d&csf=1&web=1&e=RaRmUc', '_blank'); setMenuOpen(false); }}
        icon={FiShare2}
        title="Curriculum"
        subtitle="Open curriculum planning"
      />







      <MenuButton
        onClick={() => { onViewChange('approve-bookings'); setMenuOpen(false); }}
        icon={FiCheckSquare}
        title="Approve Booking"
        subtitle="Review pending bookings"
      />





      <MenuButton
        onClick={() => { window.open('https://stalwart-macaron-c9e629.netlify.app/', '_blank'); setMenuOpen(false); }}
        icon={FiAward}
        title="Certificates"
        subtitle="Open certificates portal"
      />
      <MenuButton
        onClick={() => { setShowSettingsModal(true); setMenuOpen(false); }}
        icon={FiSettings}
        title="Setting"
        subtitle="Configure global options"
      />
    </>
  );

  const renderCMMenu = () => (
    <>
      <button
        onClick={() => { onRequestBooking?.(); setMenuOpen(false); }}
        className="flex items-center p-3 rounded-xl transition-colors group w-full bg-red-50 hover:bg-red-100 mb-1"
      >
        <div className="bg-white p-2.5 rounded-lg shadow-sm mr-3 text-red-600">
          <SafeIcon icon={FiCalendar} className="h-4 w-4" />
        </div>
        <div className="text-left">
          <p className="text-sm font-bold text-red-700">Request a Booking</p>
          <p className="text-[10px] text-red-500 font-medium">Submit an external room request</p>
        </div>
      </button>

      <MenuButton
        onClick={() => { setShowQRModal(true); setMenuOpen(false); }}
        icon={FiSmartphone}
        title="QR Access"
        subtitle="Scan for mobile view"
      />


      <MenuButton
        onClick={() => { onViewChange('term-dates'); setMenuOpen(false); }}
        icon={FiCalendar}
        title="Terms dates"
        subtitle="View and copy dates"
      />
      <MenuButton
        onClick={() => { window.open('https://lbharingey.sharepoint.com/sites/haringeylearns/Shared%20Documents/Forms/AllItems.aspx', '_blank'); setMenuOpen(false); }}
        icon={FiShare2}
        title="Corp drive"
        subtitle="Open SharePoint documents"
      />
      <MenuButton
        onClick={() => { window.open('https://lbharingey.sharepoint.com/:x:/r/sites/haringeylearns/Shared%20Documents/HL%20Service%20file/HL%20Curriculum%20%26%20Quality/HL%20Curriculum%20Planning/Curriculum%20Planning.xlsx?d=w41e82f297d8a45cea090df4859adbc6d&csf=1&web=1&e=RaRmUc', '_blank'); setMenuOpen(false); }}
        icon={FiShare2}
        title="Curriculum"
        subtitle="Open curriculum planning"
      />







      <MenuButton
        onClick={() => { window.open('https://stalwart-macaron-c9e629.netlify.app/', '_blank'); setMenuOpen(false); }}
        icon={FiAward}
        title="Certificates"
        subtitle="Open certificates portal"
      />


    </>
  );

  const renderStandardUserMenu = () => (
    <>
      <button
        onClick={() => { onRequestBooking?.(); setMenuOpen(false); }}
        className="flex items-center p-3 rounded-xl transition-colors group w-full bg-red-50 hover:bg-red-100 mb-1"
      >
        <div className="bg-white p-2.5 rounded-lg shadow-sm mr-3 text-red-600">
          <SafeIcon icon={FiCalendar} className="h-4 w-4" />
        </div>
        <div className="text-left">
          <p className="text-sm font-bold text-red-700">Request a Booking</p>
          <p className="text-[10px] text-red-500 font-medium">Submit an external room request</p>
        </div>
      </button>

      <MenuButton
        onClick={() => { setShowQRModal(true); setMenuOpen(false); }}
        icon={FiSmartphone}
        title="QR Access"
        subtitle="Scan for mobile view"
      />

      <MenuButton
        onClick={() => { onViewChange('term-dates'); setMenuOpen(false); }}
        icon={FiCalendar}
        title="Terms dates"
        subtitle="View and copy dates"
      />
      <MenuButton
        onClick={() => { window.open('https://lbharingey.sharepoint.com/sites/haringeylearns/Shared%20Documents/Forms/AllItems.aspx', '_blank'); setMenuOpen(false); }}
        icon={FiShare2}
        title="Corp drive"
        subtitle="Open SharePoint documents"
      />
      <MenuButton
        onClick={() => { window.open('https://lbharingey.sharepoint.com/:x:/r/sites/haringeylearns/Shared%20Documents/HL%20Service%20file/HL%20Curriculum%20%26%20Quality/HL%20Curriculum%20Planning/Curriculum%20Planning.xlsx?d=w41e82f297d8a45cea090df4859adbc6d&csf=1&web=1&e=RaRmUc', '_blank'); setMenuOpen(false); }}
        icon={FiShare2}
        title="Curriculum"
        subtitle="Open curriculum planning"
      />


      <MenuButton
        onClick={() => { window.open('https://stalwart-macaron-c9e629.netlify.app/', '_blank'); setMenuOpen(false); }}
        icon={FiAward}
        title="Certificates"
        subtitle="Open certificates portal"
      />
    </>
  );

  const renderGuestMenu = () => (
    <>
      <button
        onClick={() => { onRequestBooking?.(); setMenuOpen(false); }}
        className="flex items-center p-3 rounded-xl transition-colors group w-full bg-red-50 hover:bg-red-100 mb-1"
      >
        <div className="bg-white p-2.5 rounded-lg shadow-sm mr-3 text-red-600">
          <SafeIcon icon={FiCalendar} className="h-4 w-4" />
        </div>
        <div className="text-left">
          <p className="text-sm font-bold text-red-700">Request a Booking</p>
          <p className="text-[10px] text-red-500 font-medium">Submit an external room request</p>
        </div>
      </button>
      <MenuButton
        onClick={() => { onViewChange('today'); setMenuOpen(false); }}
        icon={FiList}
        title="Homepage"
        subtitle="View today's classes"
      />
      <MenuButton
        onClick={() => { onViewChange('calendar'); setMenuOpen(false); }}
        icon={FiGrid}
        title="Timetable"
        subtitle="View full schedule"
      />

      <MenuButton
        onClick={() => { setShowQRModal(true); setMenuOpen(false); }}
        icon={FiSmartphone}
        title="QR Access"
        subtitle="Scan for mobile view"
      />
      <MenuButton
        onClick={() => { onViewChange('term-dates'); setMenuOpen(false); }}
        icon={FiCalendar}
        title="Term dates"
        subtitle="View and copy dates"
      />
    </>
  );

  return (
    <>
      <header ref={headerRef} className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="w-full px-2 sm:px-6 lg:px-10">
          <div className="flex justify-between items-center h-18 py-4">
            <button 
              onClick={() => onViewChange('today')}
              className="flex items-center hover:opacity-80 transition-opacity focus:outline-none"
            >
              <div className="p-2 mr-2 md:mr-3">
                <img src="/Logo.png" alt="SCHEDUPRO" className="h-8 w-8" />
              </div>
              <div className="text-left">
                <h1 className="text-base md:text-lg font-black text-gray-900 tracking-tight leading-none">SCHEDUPRO</h1>
                <p className="hidden md:block text-[10px] font-bold text-blue-600 uppercase tracking-widest mt-0.5">CURRICULUM PLANNING</p>
              </div>
            </button>

            <div className="flex items-center bg-gray-50 border border-gray-200 rounded-2xl p-1 shadow-inner">
              <button
                onClick={() => navigateDate('prev')}
                className="p-2 rounded-xl hover:bg-white hover:shadow-sm text-gray-500 transition-all"
              >
                <SafeIcon icon={FiChevronLeft} className="h-5 w-5" />
              </button>
              
              <div className="relative px-2">
                <input
                  type="date"
                  value={format(selectedDate, 'yyyy-MM-dd')}
                  onChange={handleDateChange}
                  className="bg-transparent text-sm font-bold text-gray-800 focus:outline-none cursor-pointer px-2"
                />
              </div>
              
              <button
                onClick={() => navigateDate('next')}
                className="p-2 rounded-xl hover:bg-white hover:shadow-sm text-gray-500 transition-all"
              >
                <SafeIcon icon={FiChevronRight} className="h-5 w-5" />
              </button>
            </div>

            <div className="flex items-center space-x-3">
              <div className="hidden lg:flex bg-gray-100 rounded-xl p-1 mr-2 border border-gray-200">
                <button
                  onClick={() => onViewChange('today')}
                  className={`flex items-center px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    currentView === 'today' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <SafeIcon icon={FiList} className="w-3.5 h-3.5 mr-2" />
                  Today
                </button>
                <button
                  onClick={() => onViewChange('calendar')}
                  className={`flex items-center px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    currentView === 'calendar' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <SafeIcon icon={FiGrid} className="w-3.5 h-3.5 mr-2" />
                  Grid
                </button>
                <button
                  onClick={() => onViewChange('courses')}
                  className={`flex items-center px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    currentView === 'courses' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <SafeIcon icon={FiBook} className="w-3.5 h-3.5 mr-2" />
                  Courses
                </button>
                <button
                  onClick={() => onViewChange('course-calendar')}
                  className={`flex items-center px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    currentView === 'course-calendar' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <SafeIcon icon={FiCalendar} className="w-3.5 h-3.5 mr-2" />
                  Course Calendar
                </button>
                <button
                  onClick={() => onViewChange('room-calendar')}
                  className={`flex items-center px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    currentView === 'room-calendar' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <SafeIcon icon={FiLayout} className="w-3.5 h-3.5 mr-2" />
                  Room Calendar
                </button>
                <button
                  onClick={() => onViewChange('tutor-calendar')}
                  className={`flex items-center px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    currentView === 'tutor-calendar' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <SafeIcon icon={FiUser} className="w-3.5 h-3.5 mr-2" />
                  Tutor Calendar
                </button>
                <button
                  onClick={() => onViewChange('database')}
                  className={`flex items-center px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    currentView === 'database' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-900'
                  }`}
                >
                  <SafeIcon icon={FiDatabase} className="w-3.5 h-3.5 mr-2" />
                  Sessions
                </button>
              </div>

              {isSuperuser() && (
                <button
                  onClick={onBookRoom}
                  className="hidden sm:flex items-center px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 hover:scale-[1.02] active:scale-[0.98] transition-all text-xs font-black shadow-lg shadow-blue-100"
                >
                  <SafeIcon icon={FiPlus} className="w-4 h-4 mr-2" />
                  BOOK ROOM
                </button>
              )}

              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="p-2.5 rounded-xl bg-white border border-gray-200 hover:border-blue-400 hover:text-blue-600 transition-all shadow-sm"
              >
                <SafeIcon icon={menuOpen ? FiX : FiMenu} className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        {menuOpen && (
          <div className="absolute top-full right-0 w-80 bg-white border border-gray-100 shadow-2xl animate-in slide-in-from-top-4 duration-200 rounded-b-2xl m-2 overflow-y-auto max-h-[80vh]">
            <div className="flex flex-col gap-2 p-4">
              {isSuperuser() ? renderSuperuserMenu() : 
               isCM() ? renderCMMenu() : 
               user ? renderStandardUserMenu() : 
               renderGuestMenu()}

              {user && (
                <>
                  <div className="h-px bg-gray-100 my-1"></div>
                  
                  <div className="flex items-center p-3 rounded-xl mb-1 bg-gray-50/50 border border-gray-100">
                    <div className="bg-white p-2.5 rounded-lg shadow-sm mr-3 text-blue-600">
                      <SafeIcon icon={FiUser} className="h-4 w-4" />
                    </div>
                    <div className="text-left overflow-hidden">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Signed in as</p>
                      <p className="text-sm font-bold text-gray-900 truncate max-w-[180px]" title={user.email}>{user.email}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => { onLogout?.(); setMenuOpen(false); }}
                    className="flex items-center p-3 bg-gray-50 rounded-xl hover:bg-red-50 transition-colors group w-full"
                  >
                    <div className="bg-white p-2.5 rounded-lg shadow-sm mr-3 group-hover:text-red-600 transition-colors">
                      <SafeIcon icon={FiLogOut} className="h-4 w-4" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-gray-900">Logout</p>
                      <p className="text-[10px] text-gray-500 font-medium">Sign out of your account</p>
                    </div>
                  </button>
                </>
              )}

              {!user && (
                <>
                  <div className="h-px bg-gray-100 my-1"></div>
                  <a
                    href="/api/auth/login"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center p-3 bg-gray-50 rounded-xl hover:bg-blue-50 transition-colors group w-full"
                  >
                    <div className="bg-white p-2.5 rounded-lg shadow-sm mr-3 group-hover:text-blue-600 transition-colors">
                      <SafeIcon icon={FiLogIn} className="h-4 w-4" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold text-gray-900">Login</p>
                      <p className="text-[10px] text-gray-500 font-medium">Sign in with Microsoft</p>
                    </div>
                  </a>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <QRCodeModal isOpen={showQRModal} onClose={() => setShowQRModal(false)} />
      {isSuperuser() && (
        <>
          <SettingsModal isOpen={showSettingsModal} onClose={() => setShowSettingsModal(false)} />
        </>
      )}
    </>
  );
};

export default Header;
