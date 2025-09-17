import { useState, useEffect, useContext, useCallback } from 'preact/hooks';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { ApiServiceContext } from '../../services/ApiService.js';
import { Spinner } from '../../components/Spinner.jsx';
import { faEdit } from '@fortawesome/free-solid-svg-icons/faEdit';
import { faSave } from '@fortawesome/free-solid-svg-icons/faSave';

export default function ShotNotesCard({ shot, onNotesUpdate, onNotesLoaded }) {
  const apiService = useContext(ApiServiceContext);

  const [notes, setNotes] = useState({
    id: shot.id,
    rating: 0,
    doseIn: '',
    doseOut: '',
    ratio: '',
    grindSetting: '',
    balanceTaste: 'balanced',
    notes: '',
  });

  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);

  // Calculate ratio function
  const calculateRatio = useCallback((doseIn, doseOut) => {
    if (doseIn && doseOut && parseFloat(doseIn) > 0 && parseFloat(doseOut) > 0) {
      return (parseFloat(doseOut) / parseFloat(doseIn)).toFixed(2);
    }
    return '';
  }, []);

  // Load notes ONLY on component mount
  useEffect(() => {
    if (initialLoaded) return; // Prevent reloading

    const loadNotes = async () => {
      try {
        const response = await apiService.request({
          tp: 'req:history:notes:get',
          id: shot.id,
        });

        let loadedNotes = {
          id: shot.id,
          rating: 0,
          doseIn: '',
          doseOut: '',
          ratio: '',
          grindSetting: '',
          balanceTaste: 'balanced',
          notes: '',
        };

        if (response.notes && Object.keys(response.notes).length > 0) {
          // Parse response.notes if it's a string
          let parsedNotes = response.notes;
          if (typeof response.notes === 'string') {
            try {
              parsedNotes = JSON.parse(response.notes);
            } catch (e) {
              console.warn('Failed to parse notes JSON:', e);
              parsedNotes = {};
            }
          }

          // Merge loaded notes with defaults
          loadedNotes = { ...loadedNotes, ...parsedNotes };
        }

        // Pre-populate doseOut with shot.volume if it's empty and shot.volume exists
        if (!loadedNotes.doseOut && shot.volume) {
          loadedNotes.doseOut = shot.volume.toFixed(1);
        }

        // Calculate ratio from loaded data
        if (loadedNotes.doseIn && loadedNotes.doseOut) {
          loadedNotes.ratio = calculateRatio(loadedNotes.doseIn, loadedNotes.doseOut);
        }

        setNotes(loadedNotes);
        setInitialLoaded(true);
        // Pass loaded notes to parent
        if (onNotesLoaded) {
          onNotesLoaded(loadedNotes);
        }
      } catch (error) {
        console.error('Failed to load notes:', error);

        // Even if loading fails, set up defaults
        const defaultNotes = {
          id: shot.id,
          rating: 0,
          doseIn: '',
          doseOut: shot.volume ? shot.volume.toFixed(1) : '',
          ratio: '',
          grindSetting: '',
          balanceTaste: 'balanced',
          notes: '',
        };

        setNotes(defaultNotes);
        setInitialLoaded(true);
        if (onNotesLoaded) {
          onNotesLoaded(defaultNotes);
        }
      }
    };

    loadNotes();
  }, []); // No dependencies - only run once

  // Reset if shot changes
  useEffect(() => {
    if (notes.id !== shot.id) {
      setInitialLoaded(false);
      setIsEditing(false);
    }
  }, [shot.id, notes.id]);

  const saveNotes = async () => {
    setLoading(true);
    try {
      await apiService.request({
        tp: 'req:history:notes:save',
        id: shot.id,
        notes: notes,
      });
      setIsEditing(false);
      if (onNotesUpdate) {
        onNotesUpdate(notes);
      }
    } catch (error) {
      console.error('Failed to save notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setNotes(prev => {
      const newNotes = { ...prev, [field]: value };

      // Only recalculate ratio if we're changing doseIn or doseOut
      if ((field === 'doseIn' || field === 'doseOut') && initialLoaded) {
        const doseIn = field === 'doseIn' ? value : prev.doseIn;
        const doseOut = field === 'doseOut' ? value : prev.doseOut;
        newNotes.ratio = calculateRatio(doseIn, doseOut);
      }

      return newNotes;
    });
  };

  const renderStars = (rating, editable = false) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <button
          key={i}
          type='button'
          disabled={!editable}
          onClick={() => editable && handleInputChange('rating', i)}
          className={`text-lg ${i <= rating ? 'text-yellow-400' : 'text-gray-300'} ${
            editable ? 'cursor-pointer hover:text-yellow-300' : 'cursor-default'
          }`}
        >
          ★
        </button>,
      );
    }
    return stars;
  };

  const getTasteColor = taste => {
    switch (taste) {
      case 'bitter':
        return 'text-orange-600';
      case 'sour':
        return 'text-yellow-600';
      case 'balanced':
        return 'text-green-600';
      default:
        return '';
    }
  };

  // Don't render until initial load is complete
  if (!initialLoaded) {
    return (
      <div className='mt-6 border-t pt-6'>
        <div className='flex items-center justify-center py-8'>
          <span className='loading loading-spinner loading-md'></span>
        </div>
      </div>
    );
  }

  return (
    <div className='border-t-base-content/10 accent mt-6 border-t-2 pt-6'>
      <div className='mb-4 flex items-center justify-between'>
        <h3 className='text-lg font-semibold'>Shot Notes</h3>
        {!isEditing ? (
          <button onClick={() => setIsEditing(true)} className='btn btn-sm btn-outline'>
            <FontAwesomeIcon icon={faEdit} />
            Edit
          </button>
        ) : (
          <div className='flex gap-2'>
            <button
              onClick={() => setIsEditing(false)}
              className='btn btn-sm btn-ghost'
              disabled={loading}
            >
              Cancel
            </button>
            <button onClick={saveNotes} className='btn btn-sm btn-primary' disabled={loading}>
              {loading ? (
                <Spinner size={4} />
              ) : (
                <>
                  <FontAwesomeIcon icon={faSave} />
                  Save
                </>
              )}
            </button>
          </div>
        )}
      </div>

      <div className='grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3'>
        {/* Rating */}
        <div className='form-control'>
          <label className='mb-2 block text-sm font-medium'>Rating</label>
          <div className='flex gap-1'>{renderStars(notes.rating, isEditing)}</div>
        </div>

        {/* Dose In */}
        <div className='form-control'>
          <label className='mb-2 block text-sm font-medium'>Dose In (g)</label>
          {isEditing ? (
            <input
              type='number'
              step='0.1'
              className='input input-bordered w-full'
              value={notes.doseIn}
              onChange={e => handleInputChange('doseIn', e.target.value)}
              placeholder='18.0'
            />
          ) : (
            <div className='input input-bordered bg-base-200 w-full cursor-default'>
              {notes.doseIn || '—'}
            </div>
          )}
        </div>

        {/* Dose Out */}
        <div className='form-control'>
          <label className='mb-2 block text-sm font-medium'>Dose Out (g)</label>
          {isEditing ? (
            <input
              type='number'
              step='0.1'
              className='input input-bordered w-full'
              value={notes.doseOut}
              onChange={e => handleInputChange('doseOut', e.target.value)}
              placeholder='36.0'
            />
          ) : (
            <div className='input input-bordered bg-base-200 w-full cursor-default'>
              {notes.doseOut || '—'}
            </div>
          )}
        </div>

        {/* Ratio */}
        <div className='form-control'>
          <label className='mb-2 block text-sm font-medium'>Ratio (1:{notes.ratio || '—'})</label>
          <div className='input input-bordered bg-base-200 w-full cursor-default'>
            {notes.ratio ? `1:${notes.ratio}` : '—'}
          </div>
        </div>

        {/* Grind Setting */}
        <div className='form-control'>
          <label className='mb-2 block text-sm font-medium'>Grind Setting</label>
          {isEditing ? (
            <input
              type='text'
              className='input input-bordered w-full'
              value={notes.grindSetting}
              onChange={e => handleInputChange('grindSetting', e.target.value)}
              placeholder='e.g., 2.5, Medium-Fine'
            />
          ) : (
            <div className='input input-bordered bg-base-200 w-full cursor-default'>
              {notes.grindSetting || '—'}
            </div>
          )}
        </div>

        {/* Balance/Taste */}
        <div className='form-control'>
          <label className='mb-2 block text-sm font-medium'>Balance/Taste</label>
          {isEditing ? (
            <select
              className='select select-bordered w-full'
              value={notes.balanceTaste}
              onChange={e => handleInputChange('balanceTaste', e.target.value)}
            >
              <option value='bitter'>Bitter</option>
              <option value='balanced'>Balanced</option>
              <option value='sour'>Sour</option>
            </select>
          ) : (
            <div
              className={`input input-bordered bg-base-200 w-full cursor-default capitalize ${getTasteColor(notes.balanceTaste)}`}
            >
              {notes.balanceTaste}
            </div>
          )}
        </div>
      </div>

      {/* Notes Text Area - Full Width */}
      <div className='form-control mt-6'>
        <label className='mb-2 block text-sm font-medium'>Notes</label>
        {isEditing ? (
          <textarea
            className='textarea textarea-bordered w-full'
            rows='4'
            value={notes.notes}
            onChange={e => handleInputChange('notes', e.target.value)}
            placeholder='Tasting notes, brewing observations, etc...'
          />
        ) : (
          <div className='textarea textarea-bordered bg-base-200 min-h-[6rem] w-full cursor-default'>
            {notes.notes || 'No notes added'}
          </div>
        )}
      </div>
    </div>
  );
}
