// converter.js
document.addEventListener('DOMContentLoaded', function () {
  const downloadExe = document.getElementById('downloadExe');
  const convertBtn = document.getElementById('convertBtn');
  const clearBtn = document.getElementById('clearBtn');
  const spinner = document.getElementById('spinner');
  const status = document.getElementById('status');

  // helper
  function resetState() {
    spinner.classList.add('hidden');
    status.classList.add('hidden');
    status.textContent = '';
  }

  // exe download simulation
  if (downloadExe) {
    downloadExe.addEventListener('click', function (e) {
      e.preventDefault();
      const blob = new Blob(
        ["This simulates the converter EXE.\nRun it to generate JSON."],
        { type: "text/plain" }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'converter.exe.txt';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  }

  // clear button
  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      const form = document.getElementById('convForm');
      if (form) form.reset();
      resetState();
    });
  }

  // convert button
  if (convertBtn) {
    convertBtn.addEventListener('click', function () {
      resetState();
      const xml = document.getElementById('xmlFile')?.files[0];
      const json = document.getElementById('jsonFile')?.files[0];

      if (!xml || !json) {
        status.classList.remove('hidden');
        status.textContent = 'Please provide both files: Workflow XML and JSON.';
        return;
      }

      if (!xml.name.toLowerCase().endsWith('.xml')) {
        status.classList.remove('hidden');
        status.textContent = 'Invalid file type: Workflow file must be .xml';
        return;
      }

      if (!json.name.toLowerCase().endsWith('.json')) {
        status.classList.remove('hidden');
        status.textContent = 'Invalid file type: Procedure structure file must be .json';
        return;
      }

      // show spinner / disable button (keep these lines)
      spinner.classList.remove('hidden');
      status.classList.remove('hidden');
      status.textContent = 'Uploading and converting…';
      convertBtn.disabled = true;

      // perform upload to server and download returned zip
      (async function () {
        try {
          const xmlText = await xml.text();
          const metaText = await json.text();
          const res = await fetch('/api/convert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ xmlContent: xmlText, fileName: xml.name, metadata: metaText })
          });

          if (!res.ok) {
            let text = '';
            try { text = await res.text(); } catch (e) { text = res.statusText; }
            throw new Error(`Server error: ${res.status} ${res.statusText} — ${text}`);
          }

          // get response as blob (zip) and determine filename
          const blob = await res.blob();
          let filename = 'converted.zip';
          const cd = res.headers.get('content-disposition') || '';
          // try to extract filename from Content-Disposition
          const fnMatch1 = cd.match(/filename\*=UTF-8''([^;]+)/i);
          const fnMatch2 = cd.match(/filename="([^"]+)"/);
          const fnMatch3 = cd.match(/filename=([^;]+)/);
          if (fnMatch1) {
            filename = decodeURIComponent(fnMatch1[1]);
          } else if (fnMatch2) {
            filename = fnMatch2[1];
          } else if (fnMatch3) {
            filename = fnMatch3[1].trim();
          }

          // trigger download
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          link.remove();
          setTimeout(() => URL.revokeObjectURL(link.href), 2000);

          status.textContent = 'Conversion complete — download started.';
        } catch (err) {
          console.error('Conversion error:', err);
          status.textContent = 'Conversion failed: ' + (err.message || err);
          status.style.color = 'red';
        } finally {
          spinner.classList.add('hidden');
          convertBtn.disabled = false;
        }
      })();



    });
  }


});
