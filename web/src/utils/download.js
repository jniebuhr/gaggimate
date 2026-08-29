export function downloadBlob(blob, filename) {
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
    a.remove();
    URL.revokeObjectURL(url);
  }, 10);
}

export function downloadJson(json, filename) {
  const jsonStr = JSON.stringify(json, undefined, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  downloadBlob(blob, filename);
}

export async function downloadJsonQueue(files, delayMs = 500) {
  for (const [index, file] of files.entries()) {
    downloadJson(file.json, file.filename);
    if (index < files.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
}
