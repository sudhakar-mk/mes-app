// api/convert/index.js (debug mode — returns full stack on error)
const JSZip = require('jszip');
const { JSDOM } = require('jsdom');
const customConv = require('../ProcessXML/custom_sp_convert.js');
const productConv = require('../ProcessXML/product_sp_convert.js');

// jsdom DOMParser + XMLSerializer shim
global.DOMParser = function () {
  this.parseFromString = function (str, contentType = 'text/xml') {
    const dom = new JSDOM(str, { contentType });
    return dom.window.document;
  };
};
global.XMLSerializer = function () { };
global.XMLSerializer.prototype.serializeToString = function (node) {
  if (node && node.ownerDocument && node.ownerDocument.defaultView && node.ownerDocument.defaultView.XMLSerializer) {
    const SerializerCtor = node.ownerDocument.defaultView.XMLSerializer;
    const ser = new SerializerCtor();
    return ser.serializeToString(node);
  }
  const dom = new JSDOM();
  const FallbackSerializer = dom.window.XMLSerializer;
  const fallbackSer = new FallbackSerializer();
  return fallbackSer.serializeToString(node);
};

module.exports = async function (context, req) {
  try {
    context.log('[function] /api/convert called (debug mode)');

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
    // DEBUG: return full stack trace in response so you can see the error in the browser
    const stack = err && err.stack ? err.stack : String(err);
    context.log.error('[function] conversion error:', stack);
    context.res = {
      status: 500,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      body: `Server debug error:\n\n${stack}`
    };
  }
};
