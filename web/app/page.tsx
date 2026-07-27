"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function WelcomePage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const [showDemo, setShowDemo] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4" />
          <p className="text-emerald-700">Loading Changers...</p>
        </div>
      </div>
    );
  }

  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50">
      {/* Navigation */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-emerald-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <span className="text-3xl">🌿</span>
              <span className="text-xl font-bold text-emerald-800">Changers</span>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/sign-in" className="text-emerald-600 hover:text-emerald-800 font-medium">
                Sign in
              </Link>
              <Link
                href="/sign-up"
                className="bg-emerald-600 text-white px-6 py-2 rounded-full hover:bg-emerald-700 transition-all shadow-md hover:shadow-lg font-medium"
              >
                Get started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
        <div className="text-center max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-2 rounded-full text-sm font-medium mb-8">
            <span>🌱</span>
            <span>A changemaker community for students & young leaders</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold text-gray-900 mb-8 leading-tight">
            Build projects that
            <span className="text-emerald-600"> change the world</span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-600 mb-12 leading-relaxed max-w-3xl mx-auto">
            A collaboration-first platform for changemakers. Share ideas, build projects,
            create impact — without addictive feeds.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/sign-up"
              className="bg-emerald-600 text-white px-10 py-4 rounded-full text-lg font-semibold hover:bg-emerald-700 transition-all shadow-lg hover:shadow-xl"
            >
              Start building — it's free
            </Link>
            <button
              onClick={() => setShowDemo(!showDemo)}
              className="border-2 border-emerald-600 text-emerald-600 px-10 py-4 rounded-full text-lg font-semibold hover:bg-emerald-50 transition-all"
            >
              {showDemo ? "Close" : "See how it works"}
            </button>
          </div>
        </div>
      </section>

      {/* Demo Overlay */}
      {showDemo && (
        <section className="max-w-5xl mx-auto px-4 pb-20">
          <div className="bg-white rounded-3xl shadow-2xl p-8 md:p-12">
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">How Changers works</h3>
                <ul className="space-y-4">
                  <li className="flex gap-3">
                    <span className="text-emerald-600 text-xl">1</span>
                    <div>
                      <p className="font-semibold text-gray-900">Create your profile</p>
                      <p className="text-gray-600 text-sm">Show your interests and what you want to work on.</p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-emerald-600 text-xl">2</span>
                    <div>
                      <p className="font-semibold text-gray-900">Join or start a Base</p>
                      <p className="text-gray-600 text-sm">Collaborative project spaces with AI tools.</p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-emerald-600 text-xl">3</span>
                    <div>
                      <p className="font-semibold text-gray-900">Use AI-powered tools</p>
                      <p className="text-gray-600 text-sm">Document editor, slideshow maker, research assistant.</p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="text-emerald-600 text-xl">4</span>
                    <div>
                      <p className="font-semibold text-gray-900">Track your impact</p>
                      <p className="text-gray-600 text-sm">See your sustainability metrics and project progress.</p>
                    </div>
                  </li>
                </ul>
                <Link
                  href="/sign-up"
                  className="inline-block mt-6 bg-emerald-600 text-white px-6 py-3 rounded-full font-semibold hover:bg-emerald-700 transition-all"
                >
                  Get started
                </Link>
              </div>
              <div className="bg-gradient-to-br from-emerald-100 to-teal-100 rounded-2xl p-8">
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center text-white font-bold">Y</div>
                    <div>
                      <p className="font-semibold text-sm">Your Base</p>
                      <p className="text-xs text-gray-500">Climate Action Project</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="bg-emerald-50 rounded-lg p-3">
                      <p className="text-sm font-medium">📄 Project Proposal</p>
                      <p className="text-xs text-gray-500">Last edited 2m ago • AI-assisted</p>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-3">
                      <p className="text-sm font-medium">📊 Impact Dashboard</p>
                      <p className="text-xs text-gray-500">12 kg CO₂ saved this week</p>
                    </div>
                    <div className="bg-emerald-50 rounded-lg p-3">
                      <p className="text-sm font-medium">💬 Team Discussion</p>
                      <p className="text-xs text-gray-500">4 new messages</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Features Section */}
      <section className="bg-white py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Built for changemakers, not for addiction
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              No infinite scroll. No algorithmic feeds. Just tools to collaborate, create, and track your impact.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-emerald-50 rounded-2xl p-8 hover:shadow-lg transition-shadow">
              <div className="text-4xl mb-4">🏢</div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Bases</h3>
              <p className="text-gray-600 mb-4">
                Collaborative project spaces with built-in AI tools, document editing, version control, and real-time team chat.
              </p>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>✓ AI-powered document editor</li>
                <li>✓ Slideshow maker & templates</li>
                <li>✓ Project boards & tracking</li>
                <li>✓ Real-time collaboration</li>
              </ul>
            </div>

            <div className="bg-teal-50 rounded-2xl p-8 hover:shadow-lg transition-shadow">
              <div className="text-4xl mb-4">🤖</div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">AI Tools</h3>
              <p className="text-gray-600 mb-4">
                Smart assistants that help you write, research, brainstorm, and organize — without taking over.
              </p>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>✓ Research assistant</li>
                <li>✓ Content generation</li>
                <li>✓ Project suggestions</li>
                <li>✓ Impact analysis</li>
              </ul>
            </div>

            <div className="bg-cyan-50 rounded-2xl p-8 hover:shadow-lg transition-shadow">
              <div className="text-4xl mb-4">🌱</div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">Impact Tracking</h3>
              <p className="text-gray-600 mb-4">
                See your real environmental impact, project progress, and contribution to the community.
              </p>
              <ul className="space-y-2 text-sm text-gray-600">
                <li>✓ Sustainability dashboard</li>
                <li>✓ Project milestones</li>
                <li>✓ Community contributions</li>
                <li>✓ Personal growth tracking</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-20 bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold mb-6">
            Join a community that&apos;s building something better
          </h2>
          <p className="text-xl mb-12 opacity-90 max-w-3xl mx-auto">
            No ads. No algorithms. No dopamine loops. Just real tools for real change.
          </p>
          <div className="grid md:grid-cols-3 gap-8 max-w-3xl mx-auto">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8">
              <div className="text-4xl font-bold mb-2">0</div>
              <div className="text-emerald-100">Active changemakers</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8">
              <div className="text-4xl font-bold mb-2">0</div>
              <div className="text-emerald-100">Projects launched</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8">
              <div className="text-4xl font-bold mb-2">0</div>
              <div className="text-emerald-100">kg CO₂ tracked</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold text-gray-900 mb-6">
            Ready to start building?
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Create your changemaker profile in under a minute. No email verification required.
          </p>
          <Link
            href="/sign-up"
            className="bg-emerald-600 text-white px-10 py-4 rounded-full text-lg font-semibold hover:bg-emerald-700 transition-all shadow-lg hover:shadow-xl inline-block"
          >
            Create your account
          </Link>
          <p className="mt-4 text-sm text-gray-500">
            Already have one? <Link href="/sign-in" className="text-emerald-600 hover:underline">Sign in</Link>
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-12">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <span className="text-2xl">🌿</span>
                <span className="text-white font-bold text-lg">Changers</span>
              </div>
              <p className="text-sm">
                A changemaker community platform. Built for students, by changemakers.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Platform</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/bases" className="hover:text-white">Bases</Link></li>
                <li><Link href="/projects" className="hover:text-white">Projects</Link></li>
                <li><Link href="/dashboard" className="hover:text-white">Dashboard</Link></li>
                <li><Link href="/events" className="hover:text-white">Events</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Resources</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="/about" className="hover:text-white">About</Link></li>
                <li><Link href="/privacy" className="hover:text-white">Privacy</Link></li>
                <li><Link href="/terms" className="hover:text-white">Terms</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Connect</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">GitHub</a></li>
                <li><a href="#" className="hover:text-white">Discord</a></li>
                <li><a href="#" className="hover:text-white">Twitter</a></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-sm">
            &copy; {new Date().getFullYear()} Changers. Built for sustainable impact.
          </div>
        </div>
      </footer>
    </div>
  );
}
