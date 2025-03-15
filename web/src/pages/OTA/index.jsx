import './style.css';
import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { useQuery } from 'preact-fetching';
import { Spinner } from '../../components/Spinner.jsx';

export function OTA() {
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({});
  const {
    isLoading,
    isError,
    error,
    data: fetchedSettings,
  } = useQuery(`ota`, async () => {
    const response = await fetch(`/api/ota`);
    const data = await response.json();
    return data;
  });

  const formRef = useRef();

  useEffect(() => {
    setFormData(fetchedSettings || {});
  }, [fetchedSettings]);

  const onSubmit = useCallback(
    async (e, update = false) => {
      e.preventDefault();
      setSubmitting(true);
      const form = formRef.current;
      const formData = new FormData(form);
      if (update) {
        formData.append('update', '1');
      }
      const response = await fetch(form.action, {
        method: 'post',
        body: formData,
      });
      const data = await response.json();
      setFormData(data);
      setSubmitting(false);
    },
    [setFormData, formRef]
  );

  if (isLoading) {
    return (
      <div class="p-16 flex flex-row items-center">
        <Spinner size={8} />
      </div>
    );
  }

  if (formData.updating) {
    return (
      <div class="p-16 flex flex-col items-center gap-5">
        <Spinner size={8} />
        <span className="text-xl font-medium">Updating</span>
      </div>
    );
  }

  return (
    <>
      <h2 class="text-3xl font-semibold mb-4 text-[#333333]">Updates</h2>
      <form
        method="post"
        action="/api/ota"
        ref={formRef}
        class="flex flex-col gap-4 w-full max-w-md border-b border-[#CCCCCC] pb-4"
        onSubmit={onSubmit}
      >
        <div>
          <label for="channel" class="block font-medium text-[#333333]">
            Update Channel
          </label>
          <select id="channel" name="channel" class="input-field">
            <option value="latest" selected={formData.channel === 'latest'}>
              Stable
            </option>
            {/*
            <option value="nightly" selected={formData.channel === 'nightly'}>
              Nightly
            </option>
            */}
          </select>
        </div>

        <div>
          <span class="block font-medium text-[#333333]">Current version</span>
          <span class="display-field">{formData.currentVersion}</span>
        </div>

        <div>
          <span class="block font-medium text-[#333333]">Newest version</span>
          <span class="display-field">
            v{formData.latestVersion} {formData.updateAvailable && <span class="font-bold">Update available!</span>}
          </span>
        </div>

        <div class="flex justify-center mt-6 flex-row gap-1">
          <a href="/" class="menu-button">
            Back
          </a>
          <button type="submit" class="menu-button" disabled={submitting}>
            Save Preferences
          </button>
          <input
            type="submit"
            name="update"
            class="menu-button"
            value="Update"
            disabled={submitting}
            onClick={(e) => onSubmit(e, true)}
          />
        </div>
      </form>
    </>
  );
}
