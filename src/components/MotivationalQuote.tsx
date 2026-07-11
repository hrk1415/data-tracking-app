import React, { useState } from 'react';
import { Sparkles, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Quote {
  text: string;
  author: string;
}

const MOTIVATIONAL_QUOTES: Quote[] = [
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "Focus on being productive instead of busy.", author: "Tim Ferriss" },
  { text: "You do not rise to the level of your goals. You fall to the level of your systems.", author: "James Clear" },
  { text: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.", author: "Aristotle" },
  { text: "Amateurs sit and wait for inspiration, the rest of us just get up and go to work.", author: "Stephen King" },
  { text: "Small daily improvements over time lead to stunning results.", author: "Robin Sharma" },
  { text: "The best way to predict your future is to create it.", author: "Abraham Lincoln" },
  { text: "Great things are done by a series of small things brought together.", author: "Vincent Van Gogh" },
  { text: "What we fear doing most is usually what we most need to do.", author: "Tim Ferriss" },
  { text: "Continuous improvement is better than delayed perfection.", author: "Mark Twain" },
  { text: "It is not that we have a short time to live, but that we waste a lot of it.", author: "Seneca" },
  { text: "Done is better than perfect.", author: "Sheryl Sandberg" },
  { text: "It always seems impossible until it's done.", author: "Nelson Mandela" },
  { text: "Do not let what you cannot do interfere with what you can do.", author: "John Wooden" },
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "The path to success is to take massive, determined action.", author: "Tony Robbins" },
  { text: "Make each day your masterpiece.", author: "John Wooden" },
  { text: "Action is the foundational key to all success.", author: "Pablo Picasso" },
  { text: "Your talent determines what you can do. Your motivation determines how much you are willing to do.", author: "Lou Holtz" },
  { text: "He who has a why to live can bear almost any how.", author: "Friedrich Nietzsche" }
];

// Helper to get a stable quote index based on the date
const getDailyQuoteIndex = (): number => {
  const today = new Date();
  const day = today.getDate();
  const month = today.getMonth();
  const year = today.getFullYear();
  const seed = day + month * 12 + year;
  return seed % MOTIVATIONAL_QUOTES.length;
};

export function MotivationalQuote() {
  const [currentIndex, setCurrentIndex] = useState<number>(getDailyQuoteIndex);
  const [isRotating, setIsRotating] = useState<boolean>(false);

  const handleRefresh = () => {
    setIsRotating(true);
    let nextIndex = currentIndex;
    // Ensure we get a different quote if possible
    if (MOTIVATIONAL_QUOTES.length > 1) {
      while (nextIndex === currentIndex) {
        nextIndex = Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length);
      }
    }
    setCurrentIndex(nextIndex);
    setTimeout(() => {
      setIsRotating(false);
    }, 600); // match duration of rotation
  };

  const currentQuote = MOTIVATIONAL_QUOTES[currentIndex];

  return (
    <div id="motivational-quote-widget" className="bg-editorial-bg p-5 sm:p-6 rounded-none border border-editorial-dark/15 shadow-sm relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 select-none">
      {/* Absolute watermark background quote sign */}
      <span className="absolute right-3 -bottom-10 text-[140px] font-serif font-black text-editorial-dark/[0.02] select-none pointer-events-none hidden sm:block">
        ”
      </span>

      <div className="flex items-start gap-4 flex-1">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-editorial-accent-light/50 border border-editorial-accent/15 text-editorial-accent mt-0.5">
          <Sparkles size={16} className="stroke-[1.5]" />
        </div>
        <div className="space-y-1.5 flex-1 min-w-0">
          <span className="block text-[9px] font-mono font-bold text-editorial-accent uppercase tracking-widest">
            Daily Focus & Mindset
          </span>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="pr-4"
            >
              <p className="font-serif italic text-sm sm:text-base text-editorial-dark leading-relaxed">
                “{currentQuote.text}”
              </p>
              <span className="block text-[10px] font-mono text-editorial-dark/60 uppercase tracking-wider mt-1.5">
                — {currentQuote.author}
              </span>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <button
        id="refresh-quote-btn"
        type="button"
        onClick={handleRefresh}
        className="self-end sm:self-center p-2.5 border border-editorial-dark/15 hover:border-editorial-accent hover:bg-editorial-accent-light/30 text-editorial-dark/70 hover:text-editorial-accent rounded-none transition-all cursor-pointer flex items-center justify-center bg-editorial-bg shadow-xs shrink-0 animate-none"
        title="Refresh Quote"
      >
        <motion.div
          animate={isRotating ? { rotate: -360 } : { rotate: 0 }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
        >
          <RotateCcw size={13} className="stroke-[2px]" />
        </motion.div>
      </button>
    </div>
  );
}
