
import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot, User, Loader2, Sparkles, ChevronDown, Minimize2, Paperclip, Mic, Globe, Zap } from 'lucide-react';
import { sendAIChatMessage } from '../services/geminiService';

interface Message {
  role: 'user' | 'model';
  text: string;
  timestamp: number;
}

export const ChatBot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { 
      role: 'model', 
      text: 'สวัสดีครับ! ผมคือ Spark AI ผู้ช่วยอัจฉริยะด้านคุณภาพไฟฟ้า ยินดีให้คำปรึกษาเรื่องมาตรฐานการเชื่อมต่อ (Grid Code) หรือวิเคราะห์ปัญหาหน้างานได้ทันทีครับ',
      timestamp: Date.now()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      setTimeout(scrollToBottom, 100);
    }
  }, [messages, isOpen, isLoading]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputText.trim() || isLoading) return;

    const userMsg = inputText.trim();
    const newUserMessage: Message = { role: 'user', text: userMsg, timestamp: Date.now() };
    
    setInputText('');
    setMessages(prev => [...prev, newUserMessage]);
    setIsLoading(true);

    try {
      const history = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      const responseText = await sendAIChatMessage(history, userMsg);
      
      const newAIMessage: Message = { role: 'model', text: responseText, timestamp: Date.now() };
      setMessages(prev => [...prev, newAIMessage]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'model', text: 'ขออภัยครับ ระบบขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้งในภายหลัง', timestamp: Date.now() }]);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (timestamp: number) => {
    return new Intl.DateTimeFormat('th-TH', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    }).format(timestamp);
  };

  return (
    <>
      {/* --- Floating Toggle Button --- */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-24 sm:bottom-8 right-6 z-[1000] p-4 rounded-2xl shadow-2xl transition-all duration-500 hover:scale-110 active:scale-95 flex items-center justify-center group overflow-hidden ${
          isOpen 
          ? 'bg-slate-800 text-white border border-white/10' 
          : 'bg-indigo-600 text-white shadow-indigo-600/30'
        }`}
      >
        <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
        {isOpen ? (
          <X size={24} className="animate-scale-in" />
        ) : (
          <div className="relative">
            <MessageSquare size={24} fill="currentColor" className="animate-fade-in" />
            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-indigo-600 animate-pulse"></div>
          </div>
        )}
      </button>

      {/* --- Chat Window Container --- */}
      <div 
        className={`fixed bottom-44 sm:bottom-28 right-6 w-[90vw] sm:w-[420px] h-[600px] max-h-[75vh] glass-panel rounded-3xl flex flex-col overflow-hidden transition-all duration-500 cubic-bezier(0.16, 1, 0.3, 1) transform z-[1000] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.6)] border border-white/10 ${
          isOpen ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-20 opacity-0 scale-90 pointer-events-none'
        }`}
      >
        {/* --- Header --- */}
        <div className="p-5 bg-gradient-to-r from-indigo-900/40 via-indigo-800/20 to-transparent border-b border-white/10 flex items-center justify-between backdrop-blur-3xl">
            <div className="flex items-center gap-3">
                <div className="relative">
                    <div className="p-2.5 rounded-2xl bg-indigo-500/20 border border-indigo-500/20 text-indigo-400 shadow-inner">
                        <Bot size={22} />
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-900 animate-pulse"></div>
                </div>
                <div>
                    <h3 className="font-bold text-white text-base tracking-tight leading-none mb-1">Spark AI Assistant</h3>
                    <div className="flex items-center gap-1.5">
                         <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></div>
                         <span className="text-[10px] text-indigo-300 font-black uppercase tracking-[0.15em]">Live & Online</span>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-1">
                <button onClick={() => setIsOpen(false)} className="p-2 text-slate-500 hover:text-white transition-colors">
                    <Minimize2 size={18} />
                </button>
            </div>
        </div>

        {/* --- Messages Area with Sequential Animation --- */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-slate-950/90 backdrop-blur-md">
            {messages.map((msg, idx) => (
                <div 
                  key={idx} 
                  className={`flex gap-3 animate-slide-up ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                  style={{ animationFillMode: 'both', animationDelay: `${Math.min(idx * 100, 1000)}ms` }}
                >
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border mt-1 shadow-inner ${
                      msg.role === 'model' 
                      ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' 
                      : 'bg-slate-800 border-white/5 overflow-hidden'
                    }`}>
                        {msg.role === 'model' ? <Bot size={18} /> : <img src="https://picsum.photos/32/32" alt="User" className="w-full h-full object-cover opacity-60" />}
                    </div>
                    
                    <div className={`max-w-[75%] space-y-1.5 flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                        <div 
                            className={`px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-lg transition-transform hover:scale-[1.01] ${
                                msg.role === 'user' 
                                ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-tr-none shadow-indigo-950/20' 
                                : 'bg-white/10 text-slate-100 border border-white/10 rounded-tl-none backdrop-blur-md'
                            }`}
                        >
                            {msg.text}
                        </div>
                        <div className="flex items-center gap-2 px-1 opacity-40">
                            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                                {msg.role === 'user' ? 'You' : 'Spark AI'}
                            </span>
                            <span className="w-1 h-1 rounded-full bg-slate-700"></span>
                            <span className="text-[9px] font-mono text-slate-500">
                                {formatTime(msg.timestamp)}
                            </span>
                        </div>
                    </div>
                </div>
            ))}
            
            {isLoading && (
                <div className="flex gap-3 justify-start animate-fade-in">
                     <div className="w-9 h-9 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0 border border-indigo-500/20 shadow-inner">
                        <Bot size={18} className="text-indigo-400" />
                    </div>
                    <div className="bg-white/10 px-5 py-3 rounded-2xl rounded-tl-none border border-white/10 flex gap-1.5 items-center backdrop-blur-md">
                        <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '200ms' }}></div>
                        <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '400ms' }}></div>
                    </div>
                </div>
            )}
            <div ref={messagesEndRef} className="h-4" />
        </div>

        {/* --- Input Area --- */}
        <div className="p-4 border-t border-white/5 bg-slate-900/95 backdrop-blur-2xl">
            <div className="flex items-center gap-3 mb-3 px-1 overflow-x-auto no-scrollbar scroll-smooth">
                {[
                  { label: 'Grid Code 2567', icon: <Globe size={12} /> },
                  { label: 'VSPP Check', icon: <Sparkles size={12} /> },
                  { label: 'Harmonic Limit', icon: <Zap size={12} /> }
                ].map((tag, i) => (
                  <button 
                    key={i} 
                    onClick={() => setInputText(`ขอทราบข้อมูลเกี่ยวกับ ${tag.label}`)}
                    className="flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-[10px] font-bold text-slate-400 hover:text-white transition-all active:scale-95"
                  >
                    {tag.icon} {tag.label}
                  </button>
                ))}
            </div>
            
            <form onSubmit={handleSendMessage} className="relative group">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <button type="button" className="p-1.5 text-slate-500 hover:text-indigo-400 transition-colors">
                        <Paperclip size={18} />
                    </button>
                </div>
                
                <input 
                    type="text" 
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="ถามคำถามทางเทคนิค..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-20 py-3.5 text-sm text-white focus:outline-none focus:border-indigo-500/50 transition-all placeholder-slate-600"
                />
                
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                    <button 
                        type="submit" 
                        disabled={!inputText.trim() || isLoading}
                        className="p-2.5 bg-indigo-600 text-white hover:bg-indigo-500 rounded-xl transition-all disabled:opacity-30 disabled:grayscale shadow-lg shadow-indigo-600/20 active:scale-90 flex items-center justify-center"
                    >
                        {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                    </button>
                </div>
            </form>
            
            <div className="flex items-center justify-center gap-2 mt-4 opacity-40">
                <ShieldCheck size={10} className="text-emerald-500" />
                <p className="text-[8px] text-center text-slate-500 uppercase font-black tracking-widest">
                    Gemini Enterprise Safety Protocol Active
                </p>
            </div>
        </div>
      </div>
    </>
  );
};

const ShieldCheck = ({ size, className }: { size: number, className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/>
  </svg>
);
