export function updateOtaChannel(formData, channel) {
  return {
    ...formData,
    channel: channel === 'nightly' ? 'nightly' : 'latest',
  };
}
