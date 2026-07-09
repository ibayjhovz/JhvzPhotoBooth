import React, { useState, useRef, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Mail, User, ShieldAlert } from 'lucide-react';
import VirtualKeyboard from './VirtualKeyboard';

interface EmailCaptureProps {
  onConfirm: (email: string, name?: string) => void;
  onBack: () => void;
  privacyPolicy: string;
}

export default function EmailCapture({
  onConfirm,
  onBack,
  privacyPolicy,
}: EmailCaptureProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [agree, setAgree] = useState(false);
  const [activeField, setActiveField] = useState<'email' | 'name'>('email');
  const [errorMsg, setErrorMsg] = useState('');

  const emailRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  // Auto-focus email field
  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  const validateEmail = (input: string) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(input);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg('');

    if (!email.trim()) {
      setErrorMsg('Email Address is required to send your photos!');
      setActiveField('email');
      emailRef.current?.focus();
      return;
    }

    if (!validateEmail(email)) {
      setErrorMsg('Please enter a valid email address (e.g., guest@example.com).');
      setActiveField('email');
      emailRef.current?.focus();
      return;
    }

    if (!agree) {
      setErrorMsg('Please accept the Privacy Policy to start the session.');
      return;
    }

    onConfirm(email.trim(), name.trim());
  };

  const handleKeyboardChange = (newValue: string) => {
    if (activeField === 'email') {
      setEmail(newValue);
    } else {
      setName(newValue);
    }
    setErrorMsg('');
  };

  return (
    <div className="min-h-screen bg-transparent text-white flex flex-col justify-between p-6 md:p-12 select-none" id="email-capture-view">
      {/* Header */}
      <div className="w-full max-w-4xl mx-auto flex items-center justify-between mb-2">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl active:scale-95 transition-all text-xs font-bold uppercase tracking-wider text-slate-200"
          id="btn-back-to-frames"
        >
          <ArrowLeft className="w-4 h-4 text-blue-400" /> Back
        </button>
        <div className="text-center">
          <h2 className="text-2xl sm:text-3xl font-black font-display tracking-tight text-white">Your Details</h2>
          <p className="text-xs sm:text-sm text-blue-300 font-medium mt-1">Provide your email to receive your custom photostrips</p>
        </div>
        <div className="w-20"></div> {/* Balanced spacer */}
      </div>

      {/* Main Forms Section */}
      <div className="w-full max-w-4xl mx-auto flex-1 flex flex-col lg:flex-row gap-8 items-center justify-center py-6">
        {/* Left Hand: Fields and Privacy */}
        <div className="w-full lg:w-5/12 flex flex-col gap-5">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Email Field */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold tracking-wider uppercase text-blue-300 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-blue-400" /> Email Address <span className="text-purple-400">*</span>
              </label>
              <input
                ref={emailRef}
                type="text"
                value={email}
                onFocus={() => setActiveField('email')}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="enter your email..."
                className={`w-full px-4 py-3 bg-black/40 border ${
                  activeField === 'email' ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-[0_0_12px_rgba(59,130,246,0.15)]' : 'border-white/10'
                } rounded-xl text-lg text-white font-medium placeholder-white/30 focus:outline-none transition-all`}
                id="email-input-field"
              />
            </div>

            {/* Name Field (Optional) */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold tracking-wider uppercase text-blue-300 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-purple-400" /> First Name <span className="text-white/40 text-[10px] lowercase">(optional)</span>
              </label>
              <input
                ref={nameRef}
                type="text"
                value={name}
                onFocus={() => setActiveField('name')}
                onChange={(e) => setName(e.target.value)}
                placeholder="enter your name..."
                className={`w-full px-4 py-3 bg-black/40 border ${
                  activeField === 'name' ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-[0_0_12px_rgba(59,130,246,0.15)]' : 'border-white/10'
                } rounded-xl text-lg text-white font-medium placeholder-white/30 focus:outline-none transition-all`}
                id="name-input-field"
              />
            </div>
          </form>

          {/* Privacy Notice Panel */}
          <div className="p-5 bg-white/5 border border-white/10 backdrop-blur-md rounded-2xl">
            <h4 className="text-xs font-bold text-white uppercase flex items-center gap-1.5 mb-2.5">
              <ShieldAlert className="w-4 h-4 text-blue-400" /> Privacy Notice
            </h4>
            <p className="text-[11px] leading-relaxed text-slate-300 mb-4 h-20 overflow-y-auto pr-1">
              {privacyPolicy}
            </p>

            <label className="flex items-start gap-3 cursor-pointer text-[11px] select-none">
              <input
                type="checkbox"
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 bg-black/50 border-white/10 accent-blue-600"
                id="privacy-consent-checkbox"
              />
              <span className="text-slate-300 font-bold leading-tight">
                I accept the privacy policy and consent to the digital photostrip delivery.
              </span>
            </label>
          </div>

          {/* Inline Error Displays */}
          {errorMsg && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/25 text-rose-400 text-xs font-bold rounded-xl text-center">
              {errorMsg}
            </div>
          )}
        </div>

        {/* Right Hand: Full screen friendly Virtual Keyboard */}
        <div className="w-full lg:w-7/12 flex justify-center">
          <VirtualKeyboard
            value={activeField === 'email' ? email : name}
            onChange={handleKeyboardChange}
            onEnter={handleSubmit}
            layoutType={activeField === 'email' ? 'email' : 'text'}
          />
        </div>
      </div>

      {/* Touch Action Row */}
      <div className="w-full max-w-md mx-auto z-10">
        <button
          onClick={() => handleSubmit()}
          className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-black text-xs uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-blue-500/25 active:scale-95 transition-all"
          id="btn-confirm-guest-details"
        >
          Proceed to DSLR Camera <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
