"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { NotificationsDropdown } from "@/components/NotificationsDropdown";
import { useAuth } from "@/components/AuthProvider";

export default function SharedShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, profile, signOut } = useAuth();
  const isAdmin = profile?.is_admin === true;

  async function handleSignOut() {
    await signOut();
  }

  return (
    <div className="app">
      <div className="bg-orb orb-1"></div>
      <div className="bg-orb orb-2"></div>
      <div className="bg-orb orb-3"></div>

      <header className="topbar">
        <Link href="/" className="logo">
          <span className="logo-mark"></span>
          Changers
        </Link>
        <form className="top-search" action="/search">
          <input type="search" name="q" placeholder="Search people, projects, and ideas" />
        </form>
        <div className="top-actions">
          {user && <NotificationsDropdown user={user} />}
          {user ? (
            <button className="ghost" onClick={handleSignOut}>
              Sign out
            </button>
          ) : (
            <Link className="ghost" href="/sign-in">
              Sign in
            </Link>
          )}
          <Link className="primary" href="/#compose">
            Create Post
          </Link>
        </div>
      </header>

      <div className="layout">
        <aside className="side-nav">
          <div className="nav-group">
            <p className="nav-title">Explore</p>
            <Link href="/" className={`nav-link ${pathname === '/' ? 'active' : ''}`}>
              Home Feed
            </Link>
            <Link href="/projects" className={`nav-link ${pathname.startsWith('/projects') ? 'active' : ''}`}>
              Projects
            </Link>
            <Link href="/events" className={`nav-link ${pathname.startsWith('/events') ? 'active' : ''}`}>
              Events
            </Link>
            <Link href="/rooms" className={`nav-link ${pathname === '/rooms' ? 'active' : ''}`}>
              Co-Lab Rooms
            </Link>
            <Link href="/impact" className={`nav-link ${pathname === '/impact' ? 'active' : ''}`}>
              Impact Map
            </Link>
          </div>
          <div className="nav-group">
            <p className="nav-title">Tools</p>
            <Link href="/dashboard" className={`nav-link ${pathname === '/dashboard' ? 'active' : ''}`}>
              Dashboard
            </Link>
            <Link href="/documents" className={`nav-link ${pathname.startsWith('/documents') ? 'active' : ''}`}>
              Documents
            </Link>
            <Link href="/slideshows" className={`nav-link ${pathname.startsWith('/slideshows') ? 'active' : ''}`}>
              Slideshows
            </Link>
          </div>
          <div className="nav-group">
            <p className="nav-title">Community</p>
            <Link href="/mentors" className={`nav-link ${pathname === '/mentors' ? 'active' : ''}`}>
              Mentors
            </Link>
            {user && (
              <>
                <Link href="/messages" className={`nav-link ${pathname.startsWith('/messages') ? 'active' : ''}`}>
                  Inbox
                </Link>
                <Link href="/notifications" className={`nav-link ${pathname === '/notifications' ? 'active' : ''}`}>
                  Notifications
                </Link>
                <Link href={`/profile/${user.$id}`} className={`nav-link ${pathname.startsWith('/profile') ? 'active' : ''}`}>
                  My Profile
                </Link>
              </>
            )}
            {isAdmin && (
              <Link href="/admin" className={`nav-link ${pathname === '/admin' ? 'active' : ''}`}>
                Admin
              </Link>
            )}
          </div>
          <div className="nav-card">
            <p className="eyebrow">Changers to Impact</p>
            <h3>Changemakers all the way down</h3>
            <p className="muted">
              A student-led platform inspired by the Changemaker Conference.
            </p>
          </div>
        </aside>

        <main className="main" style={{ minHeight: "60vh" }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>

        <aside className="right-rail">
          <div className="card mini">
            <p className="eyebrow">Strands</p>
            <h3>Impact Compass</h3>
            <p className="muted">
              The conference strands mirror the Sustainability Compass: Nature,
              Economy, Society, and Wellbeing.
            </p>
            <div className="compass">
              <div className="compass-item">N</div>
              <div className="compass-item">E</div>
              <div className="compass-item">S</div>
              <div className="compass-item">W</div>
            </div>
            <button className="ghost full">Filter feed</button>
          </div>
        </aside>
      </div>

      <footer className="footer">
        <div>
          <p className="logo">Changers</p>
          <p className="muted">Built for changemakers who want to build together.</p>
        </div>
        <div className="footer-links">
          <Link href="/">Home</Link>
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/projects">Projects</Link>
          <Link href="/documents">Documents</Link>
          <Link href="/slideshows">Slideshows</Link>
          <Link href="/rooms">Rooms</Link>
          <Link href="/events">Events</Link>
          <Link href="/impact">Impact</Link>
        </div>
      </footer>
    </div>
  );
}
