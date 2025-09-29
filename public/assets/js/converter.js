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

      spinner.classList.remove('hidden');
      status.classList.remove('hidden');
      status.textContent = 'Uploading and converting…';
      convertBtn.disabled = true;

      setTimeout(function () {
        spinner.classList.add('hidden');
        status.textContent = 'Conversion complete.';
        convertBtn.disabled = false;
      }, 1500);
    });
  }


});
