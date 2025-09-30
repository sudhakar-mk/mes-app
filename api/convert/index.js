// api/convert/index.js (debug mode: reveal require/load errors)
const JSZipName = 'jszip';
const JSDOMName = 'jsdom';

let JSZip, JSDOM, customConv, productConv;
let loadError = null;

try {
  JSZip = require(JSZipName);
} catch (e) {
  loadError = loadError || [];
  loadError.push(`Failed to require('${JSZipName}'): ${e && e.stack ? e.stack : e}`);
}

try {
  JSDOM = require(JSDOMName).JSDOM;
} catch (e) {
  loadError = loadError || [];
  loadError.push(`Failed to require('${JSDOMName}'): ${e && e.stack ? e.stack : e}`);
}

try {
  // converters (paths relative to api/convert/)
  customConv = require('../ProcessXML/custom_sp_convert.js');
} catch (e) {
  loadError = loadError || [];
  loadError.push(`Failed to require('../ProcessXML/custom_sp_convert.js'): ${e && e.stack ? e.stack : e}`);
}

try {
  productConv = require('../ProcessXML/product_sp_convert.js');
} catch (e) {
  loadError = loadError || [];
  loadError.push(`Failed to require('../ProcessXML/product_sp_convert.js'): ${e && e.stack ? e.stack : e}`);
}

// If any require failed, export a function that immediately returns the combined stack traces
if (loadError) {
  module.exports = async function (context, req) {
    const body = Array.isArray(loadError) ? loadError.join('\n\n----\n\n') : String(loadError);
    context.log.error('[function] Module load failed. Returning debug info.');
    context.res = {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: `Module load errors:\n\n${body}`
    };
  };
  // stop here — do not continue with normal handler
  return;
}

// --- Provide jsdom-based DOMParser + XMLSerializer shims for converters ---
global.DOMParser = function () {
  this.parseFromString = function (str, contentType = 'text/xml') {
    const dom = new JSDOM(str, { contentType });
    return dom.window.document;
  };
};

global.XMLSerializer = function () { };
global.XMLSerializer.prototype.serializeToString = function (node) {
  try {
    if (node && node.ownerDocument && node.ownerDocument.defaultView && node.ownerDocument.defaultView.XMLSerializer) {
      const SerializerCtor = node.ownerDocument.defaultView.XMLSerializer;
      const ser = new SerializerCtor();
      return ser.serializeToString(node);
    }
  } catch (e) {
    // fall through
  }
  const dom = new JSDOM();
  const FallbackSerializer = dom.window.XMLSerializer;
  const fallbackSer = new FallbackSerializer();
  return fallbackSer.serializeToString(node);
};

// --- Actual Function handler (keeps previous logic) ---
module.exports = async function (context, req) {
  try {
    context.log('[function] /api/convert called (debug-mode, requires succeeded)');

    // Expect JSON body: { xmlContent, fileName, metadata }
    const { xmlContent, fileName, metadata } = req.body || {};

    if (!xmlContent || !fileName) {
      context.res = { status: 400, body: 'xmlContent and fileName are required (send JSON)' };
      return;
    }

    // Run converters
    const out = await Promise.resolve(customConv.startConversion(xmlContent, fileName, xmlContent.length));
    const prodOut = await Promise.resolve(productConv.productSpConvertionStart(out.format2, out.fileName, out.fileLength, metadata || ''));

    // Build zip
    const zip = new JSZip();
    (prodOut.files || []).forEach(f => {
      zip.file(f.name.toLowerCase().endsWith('.xml') ? f.name : f.name + '.xml', f.content || '');
    });
    zip.file('conversion_log.txt', (out.log_text || '') + '\n' + (prodOut.log_text || ''));
    if (out.nonConverted || prodOut.nonConverted) {
      zip.file('non_converted.txt', (out.nonConverted || '') + '\n' + (prodOut.nonConverted || ''));
    }

    const content = await zip.generateAsync({ type: 'nodebuffer' });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const outName = `converted-${ts}.zip`;

    context.res = {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${outName}"`
      },
      body: content,
      isRaw: true
    };
    context.log(`[function] Conversion complete — ${content.length} bytes`);
  } catch (err) {
    const stack = err && err.stack ? err.stack : String(err);
    context.log.error('[function] conversion error:', stack);
    context.res = {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: `Server debug error:\n\n${stack}`
    };
  }
};
