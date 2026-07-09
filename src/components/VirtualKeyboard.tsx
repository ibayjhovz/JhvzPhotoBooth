import React, { useState } from 'react';
import { Delete, ArrowLeft, Globe, Space } from 'lucide-react';

interface VirtualKeyboardProps {
  value: string;
  onChange: (val: string) => void;
  onEnter?: () => void;
  layoutType?: 'email' | 'text';
}

export default function VirtualKeyboard({
  value,
  onChange,
  onEnter,
  layoutType = 'email',
}: VirtualKeyboardProps) {
  const [isShift, setIsShift] = useState(false);
  const [isSymbols, setIsSymbols] = useState(false);

  const keysRow1 = isSymbols
    ? ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']
    : isShift
    ? ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P']
    : ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'];

  const keysRow2 = isSymbols
    ? ['-', '/', ':', ';', '(', ')', '$', '&', '@', '"']
    : isShift
    ? ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', '_']
    : ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', '-'];

  const keysRow3 = isSymbols
    ? ['.', ',', '?', '!', "'", '_', '+', '=', '*', '%']
    : isShift
    ? ['Z', 'X', 'C', 'V', 'B', 'N', 'M', '<', '>', '.']
    : ['z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/'];

  const handleKeyPress = (key: string) => {
    onChange(value + key);
  };

  const handleDelete = () => {
    onChange(value.slice(0, -1));
  };

  const handleSpace = () => {
    onChange(value + ' ');
  };

  const handlePreset = (preset: string) => {
    onChange(value + preset);
  };

  return (
    <div className="w-full max-w-2xl bg-slate-900/90 backdrop-blur-md p-4 rounded-2xl border border-slate-800 shadow-2xl select-none" id="virtual-keyboard">
      {/* Keyboard rows */}
      <div className="flex flex-col gap-2">
        {/* Row 1 */}
        <div className="flex gap-1.5 justify-center">
          {keysRow1.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => handleKeyPress(key)}
              className="flex-1 py-3 text-lg font-medium text-white bg-slate-800 hover:bg-slate-700 active:scale-95 transition-all rounded-lg shadow-sm"
            >
              {key}
            </button>
          ))}
        </div>

        {/* Row 2 */}
        <div className="flex gap-1.5 justify-center px-4">
          {keysRow2.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => handleKeyPress(key)}
              className="flex-1 py-3 text-lg font-medium text-white bg-slate-800 hover:bg-slate-700 active:scale-95 transition-all rounded-lg shadow-sm"
            >
              {key}
            </button>
          ))}
        </div>

        {/* Row 3 */}
        <div className="flex gap-1.5 justify-center">
          <button
            type="button"
            onClick={() => setIsShift(!isShift)}
            className={`px-4 py-3 text-sm font-semibold rounded-lg shadow-sm active:scale-95 transition-all ${
              isShift ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-200'
            }`}
          >
            {isShift ? 'SHIFT' : 'shift'}
          </button>
          {keysRow3.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => handleKeyPress(key)}
              className="flex-1 py-3 text-lg font-medium text-white bg-slate-800 hover:bg-slate-700 active:scale-95 transition-all rounded-lg shadow-sm"
            >
              {key}
            </button>
          ))}
          <button
            type="button"
            onClick={handleDelete}
            className="px-4 py-3 bg-rose-600/90 hover:bg-rose-500 text-white rounded-lg shadow-sm active:scale-95 transition-all flex items-center justify-center"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>

        {/* Row 4 (Space, symbols toggler, Quick email helpers) */}
        <div className="flex gap-1.5 justify-center items-center mt-1">
          <button
            type="button"
            onClick={() => setIsSymbols(!isSymbols)}
            className="px-4 py-3.5 text-sm font-semibold bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg active:scale-95 transition-all"
          >
            {isSymbols ? 'ABC' : '123!?'}
          </button>

          {layoutType === 'email' && (
            <>
              <button
                type="button"
                onClick={() => handleKeyPress('@')}
                className="px-3.5 py-3.5 text-base font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg active:scale-95"
              >
                @
              </button>
              <button
                type="button"
                onClick={() => handlePreset('@gmail.com')}
                className="hidden sm:block px-3 py-3.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg active:scale-95"
              >
                @gmail.com
              </button>
              <button
                type="button"
                onClick={() => handlePreset('@yahoo.com')}
                className="hidden md:block px-3 py-3.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg active:scale-95"
              >
                @yahoo.com
              </button>
              <button
                type="button"
                onClick={() => handlePreset('.com')}
                className="px-3.5 py-3.5 text-base font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg active:scale-95"
              >
                .com
              </button>
            </>
          )}

          <button
            type="button"
            onClick={handleSpace}
            className="flex-1 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg shadow-sm active:scale-95 transition-all flex items-center justify-center gap-1"
          >
            <Space className="w-4 h-4" /> Space
          </button>

          <button
            type="button"
            onClick={onEnter}
            className="px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg shadow-md active:scale-95 transition-all"
          >
            ENTER
          </button>
        </div>
      </div>
    </div>
  );
}
