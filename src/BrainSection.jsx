import { useState } from 'react';
import FlashReader from './FlashReader';
import RSVPTrainer from './RSVPTrainer';
import ChunkReader from './ChunkReader';
import MemoryMatrix from './MemoryMatrix';
import StorySnapshot from './StorySnapshot';
import PeripheralTrainer from './PeripheralTrainer';
import BackwardsBuilder from './BackwardsBuilder';

const BRAIN_TABS = [
  { id: 'flash',      label: '⚡ Flash' },
  { id: 'rsvp',       label: '📖 RSVP' },
  { id: 'chunk',      label: '👁 Chunk' },
  { id: 'matrix',     label: '🔲 Matrix' },
  { id: 'snapshot',   label: '📝 Snapshot' },
  { id: 'peripheral', label: '↔ Peripheral' },
  { id: 'reverse',    label: '🔄 Reverse' },
];

export default function BrainSection() {
  const [activeTab, setActiveTab] = useState('flash');

  return (
    <div className="brain-section">
      <div className="brain-sub-nav">
        {BRAIN_TABS.map(t => (
          <button
            key={t.id}
            className={`brain-tab-btn ${activeTab === t.id ? 'brain-tab-active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="brain-content">
        {activeTab === 'flash'      && <FlashReader />}
        {activeTab === 'rsvp'       && <RSVPTrainer />}
        {activeTab === 'chunk'      && <ChunkReader />}
        {activeTab === 'matrix'     && <MemoryMatrix />}
        {activeTab === 'snapshot'   && <StorySnapshot />}
        {activeTab === 'peripheral' && <PeripheralTrainer />}
        {activeTab === 'reverse'    && <BackwardsBuilder />}
      </div>
    </div>
  );
}
