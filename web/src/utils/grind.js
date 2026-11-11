export function grindAvailable(settings, capabilities) {
  return (
    !!settings?.smartGrindActive ||
    (!capabilities?.dualBoiler && Number(settings?.altRelayFunction ?? 1) === 1)
  );
}
