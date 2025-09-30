// server.js
const express = require('express');
const path = require('path');
const multer = require('multer');
const JSZip = require('jszip');
const { DOMParser } = require('xmldom'); // provided to conversion code if needed
const cors = require('cors');
global.DOMParser = DOMParser;

// ===== jsdom DOMParser + safer XMLSerializer shim =====
try {
  const { JSDOM } = require('jsdom');

  // DOMParser that returns a jsdom Document (supports querySelectorAll)
  global.DOMParser = function () {
    this.parseFromString = function (str, contentType = 'text/xml') {
      const dom = new JSDOM(str, { contentType });
      return dom.window.document;
    };
  };

  // XMLSerializer shim that uses the serializer tied to the node's document/window.
  global.XMLSerializer = function () { };
  global.XMLSerializer.prototype.serializeToString = function (node) {
    // If node belongs to a jsdom document, use its window.XMLSerializer
    try {
      if (node && node.ownerDocument && node.ownerDocument.defaultView && node.ownerDocument.defaultView.XMLSerializer) {
        // ownerDocument.defaultView.XMLSerializer is a constructor; create instance and call
        const SerializerCtor = node.ownerDocument.defaultView.XMLSerializer;
        const ser = new SerializerCtor();
        return ser.serializeToString(node);
      }
    } catch (e) {
      // fall through to fallback below
      console.warn('[XMLSerializer shim] primary path failed:', e && e.message ? e.message : e);
    }

    // Fallback: create a fresh JSDOM and use its serializer (node may not be a jsdom node)
    try {
      const dom = new JSDOM();
      const FallbackSerializer = dom.window.XMLSerializer;
      const fallbackSer = new FallbackSerializer();
      return fallbackSer.serializeToString(node);
    } catch (e2) {
      // give a helpful error rather than crash silently
      throw new Error('[XMLSerializer shim] failed to serialize node: ' + (e2 && e2.message ? e2.message : e2));
    }
  };

  console.log('[server] using jsdom DOMParser + XMLSerializer shim (safe serializer)');
} catch (e) {
  // last-resort fallback to xmldom's DOMParser (querySelectorAll may be missing)
  const { DOMParser } = require('xmldom');
  global.DOMParser = DOMParser;
  console.warn('[server] jsdom not available; using xmldom fallback (querySelectorAll may be missing).');
}



// require your migrated/custom converter (adjust path if needed)
const customConv = require('./api/ProcessXML/custom_sp_convert.js');
const productConv = require('./api/ProcessXML/product_sp_convert.js');

const app = express();
const port = process.env.PORT || 5173;

// Middleware
app.use(cors()); // harmless when serving same origin; helpful during dev if origins differ
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from /public
app.use(express.static(path.join(__dirname, 'public')));

// Multer for handling multipart/form-data uploads in-memory
const upload = multer({ storage: multer.memoryStorage() });


app.post('/api/convert', upload.fields([
  { name: 'xmlFiles' },           // one or many
  { name: 'metadata', maxCount: 1 } // single metadata file
]), async (req, res) => {
  try {
    console.log('[server] /api/convert called');

    const xmlFilesRaw = req.files && req.files['xmlFiles'] ? req.files['xmlFiles'] : [];
    const metaFile = req.files && req.files['metadata'] && req.files['metadata'][0] ? req.files['metadata'][0] : null;

    if (!xmlFilesRaw.length) {
      return res.status(400).send('No XML files uploaded (field name: xmlFiles)');
    }

    if (!metaFile) {
      return res.status(400).send('No metadata file uploaded (field name: metadata)');
    }

    if (xmlFilesRaw.length > 1) {
      return res.status(400).send('Multiple XML files are not supported right now. Please upload only one.');
    }


    // convert buffers to usable structures
    const xmlFiles = xmlFilesRaw.map(f => ({
      name: f.originalname.replace(/\.[^/.]+$/, ''), // strip extension
      content: f.buffer.toString('utf8')
    }));
    const metadataString = metaFile.buffer.toString('utf8');

    // Provide a minimal helpers/context (DOMParser etc) if conversion code expects it
    const ctx = { DOMParser };

    // call convertFiles orchestration (see function below)
    const conversionResult = await convertFiles(xmlFiles, metadataString, ctx);

    // Build a zip from returned files
    const zip = new JSZip();

    if (conversionResult.files && Array.isArray(conversionResult.files)) {
      conversionResult.files.forEach(f => {
        // ensure filename has .xml extension if missing
        let filename = f.name;
        if (!filename.toLowerCase().endsWith('.xml')) filename = filename + '.xml';
        zip.file(filename, f.content || '');
      });
    }

    // Add conversion log and any nonConverted details
    zip.file('conversion_log.txt', conversionResult.logText || '');
    if (conversionResult.nonConverted) {
      zip.file('non_converted.txt', conversionResult.nonConverted);
    }

    const content = await zip.generateAsync({ type: 'nodebuffer' });

    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const outName = `converted-${ts}.zip`;

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${outName}"`);
    res.send(content);

    console.log(`[server] Conversion complete — returned ${content.length} bytes as ${outName}`);
  } catch (err) {
    console.error('[server] conversion error:', err && err.stack ? err.stack : err);
    // If the error is HTML (some frameworks return HTML pages), send the text but keep status 500
    const msg = (err && err.message) ? err.message : 'Internal server error during conversion';
    res.status(500).send('Conversion failed: ' + msg);
  }
});



async function convertFiles(xmlFiles, metadataString, ctx = {}) {
  const results = [];
  let aggregatedLog = '';
  let aggregatedNonConverted = '';

  for (const f of xmlFiles) {
    try {

      // call the converter; it may be sync or return a Promise, so await it safely
      const out = await Promise.resolve(
        customConv.startConversion(f.content, f.name, f.content.length)
      );

      const prodOut = await Promise.resolve(
        productConv.productSpConvertionStart(out.format2, out.fileName, out.fileLength, metadataString)
      );

      const convertedContent = out && out.format2 ? out.format2 : '';
      const convertedName = out && out.fileName ? out.fileName : f.name;

      results.push({
        name: convertedName,
        content: convertedContent
      });

      aggregatedLog += (out && out.log_text ? out.log_text : '') + '\n';
      aggregatedNonConverted += (out && out.nonConverted ? out.nonConverted : '') + '\n';
    } catch (innerErr) {
      // If a single XML fails, record error text and continue with others
      const errMsg = `Error converting ${f.name}: ${innerErr && innerErr.message ? innerErr.message : innerErr}`;
      console.error('[server] convertFiles -', errMsg);
      aggregatedLog += errMsg + '\n';
      aggregatedNonConverted += `Failed: ${f.name}\n`;
    }
  }

  return {
    files: results,
    logText: aggregatedLog.trim(),
    nonConverted: aggregatedNonConverted.trim()
  };
}


// ---------- SPA fallback for non-API requests ----------
// Keep this last so /api/* routes are handled above.
app.get('*', (req, res) => {
  // If the request is for /api/... return 404 here (route should have been handled earlier).
  if (req.path && req.path.startsWith('/api/')) {
    return res.status(404).send('API endpoint not found');
  }
  // Otherwise serve the index page (single-page app fallback)
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Dev server running at http://localhost:${port}`);
});
