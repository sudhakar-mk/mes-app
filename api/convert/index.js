const JSZip = require('jszip');
const { JSDOM } = require('jsdom');
const customConv = require('../ProcessXML/custom_sp_convert.js');
const productConv = require('../ProcessXML/product_sp_convert.js');

// Provide jsdom-based DOMParser + XMLSerializer globally (so converters work)
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
    context.log('[function] /api/convert called');

    // Expect multipart/form-data: Azure Functions does not parse this automatically.
    // Simpler for Azure: send JSON from the client instead.
    // Example body: { xmlContent: "...", fileName: "workflow1.xml", metadata: "{...}" }

    const { xmlContent, fileName, metadata } = req.body || {};

    if (!xmlContent || !fileName) {
      context.res = { status: 400, body: 'xmlContent and fileName are required' };
      return;
    }

    // Run converters
    const out = await Promise.resolve(
      customConv.startConversion(xmlContent, fileName, xmlContent.length)
    );

    const prodOut = await Promise.resolve(
      productConv.productSpConvertionStart(out.format2, out.fileName, out.fileLength, metadata || '')
    );

    // Collect files
    const results = [];
    if (prodOut && prodOut.files) {
      results.push(...prodOut.files);
    }

    // Build a zip
    const zip = new JSZip();
    results.forEach(f => {
      let fname = f.name.toLowerCase().endsWith('.xml') ? f.name : f.name + '.xml';
      zip.file(fname, f.content || '');
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
    context.log(`[function] Conversion complete — returned ${content.length} bytes as ${outName}`);
  } catch (err) {
    context.log.error('[function] conversion error:', err && err.stack ? err.stack : err);
    context.res = { status: 500, body: 'Conversion failed: ' + (err.message || err) };
  }
};
