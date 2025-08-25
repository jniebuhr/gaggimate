export function downloadJson(json, filename) {
  const jsonStr = JSON.stringify(json, undefined, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  a.target = '_blank';
  a.rel = 'noopener';

  document.body.appendChild(a);
  setTimeout(() => {
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 10);
}
