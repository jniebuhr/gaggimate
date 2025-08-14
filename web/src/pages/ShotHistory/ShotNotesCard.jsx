import { useState, useEffect, useContext } from 'preact/hooks';
import { ApiServiceContext } from '../../services/ApiService.js';

export default function ShotNotesCard({ shot, onNotesUpdate }) {
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

  // Calculate ratio when doseIn or doseOut changes
  useEffect(() => {
    if (notes.doseIn && notes.doseOut) {
      const ratio = (parseFloat(notes.doseOut) / parseFloat(notes.doseIn)).toFixed(2);
      setNotes(prev => ({ ...prev, ratio }));
    }
  }, [notes.doseIn, notes.doseOut]);

  // Load notes on component mount
  useEffect(() => {
    const loadNotes = async () => {
      try {
        const response = await apiService.request({ 
          tp: 'req:history:notes:get', 
          id: shot.id 
        });
        if (response.notes && Object.keys(response.notes).length > 0) {
          // Load existing notes, but if doseOut is empty and shot.volume exists, use shot.volume
          const loadedNotes = { ...response.notes };
          if (!loadedNotes.doseOut && shot.volume) {
            loadedNotes.doseOut = shot.volume.toFixed(1);
          }
          setNotes(prev => ({ ...prev, ...loadedNotes }));
        } else {
          // No existing notes, pre-populate doseOut with shot.volume if available
          if (shot.volume) {
            setNotes(prev => ({ ...prev, doseOut: shot.volume.toFixed(1) }));
          }
        }
      } catch (error) {
        console.error('Failed to load notes:', error);
        // Even if loading fails, pre-populate doseOut with shot.volume if available
        if (shot.volume) {
          setNotes(prev => ({ ...prev, doseOut: shot.volume.toFixed(1) }));
        }
      }
    };
    loadNotes();
  }, [shot.id, shot.volume, apiService]);

  const saveNotes = async () => {
    setLoading(true);
    try {
      await apiService.request({
        tp: 'req:history:notes:save',
        id: shot.id,
        notes: notes
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
    setNotes(prev => ({ ...prev, [field]: value }));
  };

  const renderStars = (rating, editable = false) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <button
          key={i}
          type="button"
          disabled={!editable}
          onClick={() => editable && handleInputChange('rating', i)}
          className={`text-lg ${i <= rating ? 'text-yellow-400' : 'text-gray-300'} ${
            editable ? 'hover:text-yellow-300 cursor-pointer' : 'cursor-default'
          }`}
        >
          ★
        </button>
      );
    }
    return stars;
  };

  const getTasteColor = (taste) => {
    switch (taste) {
      case 'bitter': return 'text-orange-600';
      case 'sour': return 'text-yellow-600';
      case 'balanced': return 'text-green-600';
      default: return '';
    }
  };

  return (
    <div className="mt-6 border-t pt-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Shot Notes</h3>
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="btn btn-sm btn-outline"
          >
            <span className="fa fa-edit mr-1"></span>
            Edit
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => setIsEditing(false)}
              className="btn btn-sm btn-ghost"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              onClick={saveNotes}
              className="btn btn-sm btn-primary"
              disabled={loading}
            >
              {loading ? (
                <span className="loading loading-spinner loading-xs"></span>
              ) : (
                <>
                  <span className="fa fa-save mr-1"></span>
                  Save
                </>
              )}
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Rating */}
        <div className="form-control">
          <label className="mb-2 block text-sm font-medium">
            Rating
          </label>
          <div className="flex gap-1">
            {renderStars(notes.rating, isEditing)}
          </div>
        </div>

        {/* Dose In */}
        <div className="form-control">
          <label className="mb-2 block text-sm font-medium">
            Dose In (g)
          </label>
          {isEditing ? (
            <input
              type="number"
              step="0.1"
              className="input input-bordered w-full"
              value={notes.doseIn}
              onChange={(e) => handleInputChange('doseIn', e.target.value)}
              placeholder="18.0"
            />
          ) : (
            <div className="input input-bordered w-full bg-base-200 cursor-default">
              {notes.doseIn || '—'}
            </div>
          )}
        </div>

        {/* Dose Out */}
        <div className="form-control">
          <label className="mb-2 block text-sm font-medium">
            Dose Out (g)
          </label>
          {isEditing ? (
            <input
              type="number"
              step="0.1"
              className="input input-bordered w-full"
              value={notes.doseOut}
              onChange={(e) => handleInputChange('doseOut', e.target.value)}
              placeholder="36.0"
            />
          ) : (
            <div className="input input-bordered w-full bg-base-200 cursor-default">
              {notes.doseOut || '—'}
            </div>
          )}
        </div>

        {/* Ratio */}
        <div className="form-control">
          <label className="mb-2 block text-sm font-medium">
            Ratio (1:{notes.ratio || '—'})
          </label>
          <div className="input input-bordered w-full bg-base-200 cursor-default">
            {notes.ratio ? `1:${notes.ratio}` : '—'}
          </div>
        </div>

        {/* Grind Setting */}
        <div className="form-control">
          <label className="mb-2 block text-sm font-medium">
            Grind Setting
          </label>
          {isEditing ? (
            <input
              type="text"
              className="input input-bordered w-full"
              value={notes.grindSetting}
              onChange={(e) => handleInputChange('grindSetting', e.target.value)}
              placeholder="e.g., 2.5, Medium-Fine"
            />
          ) : (
            <div className="input input-bordered w-full bg-base-200 cursor-default">
              {notes.grindSetting || '—'}
            </div>
          )}
        </div>

        {/* Balance/Taste */}
        <div className="form-control">
          <label className="mb-2 block text-sm font-medium">
            Balance/Taste
          </label>
          {isEditing ? (
            <select
              className="select select-bordered w-full"
              value={notes.balanceTaste}
              onChange={(e) => handleInputChange('balanceTaste', e.target.value)}
            >
              <option value="bitter">Bitter</option>
              <option value="balanced">Balanced</option>
              <option value="sour">Sour</option>
            </select>
          ) : (
            <div className={`input input-bordered w-full bg-base-200 cursor-default capitalize ${getTasteColor(notes.balanceTaste)}`}>
              {notes.balanceTaste}
            </div>
          )}
        </div>
      </div>

      {/* Notes Text Area - Full Width */}
      <div className="form-control mt-6">
        <label className="mb-2 block text-sm font-medium">
          Notes
        </label>
        {isEditing ? (
          <textarea
            className="textarea textarea-bordered w-full"
            rows="4"
            value={notes.notes}
            onChange={(e) => handleInputChange('notes', e.target.value)}
            placeholder="Tasting notes, brewing observations, etc..."
          />
        ) : (
          <div className="textarea textarea-bordered w-full bg-base-200 cursor-default min-h-[6rem]">
            {notes.notes || 'No notes added'}
          </div>
        )}
      </div>
    </div>
  );
}
