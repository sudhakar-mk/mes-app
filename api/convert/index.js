// api/convert/index.js (debug mode: reveal require/load errors)
const JSZipName = 'jszip';
const JSDOMName = 'jsdom';

let JSZip, JSDOM, customConv, productConv;
let loadError = null;

// ---------- Application Insights setup ----------
let appInsights;
let telemetryClient;

try {
  appInsights = require('applicationinsights');
  const connStr =
    process.env['APPINSIGHTS_CONNECTION_STRING'] ||
    process.env['APPLICATIONINSIGHTS_CONNECTION_STRING'];
  if (connStr) {
    appInsights
      .setup(connStr)
      .setAutoCollectRequests(false)
      .setAutoCollectPerformance(false)
      .setSendLiveMetrics(false)
      .start();
    telemetryClient = appInsights.defaultClient;
    console.log('[AppInsights] initialized');
  } else {
    console.warn('[AppInsights] connection string not found; telemetry disabled');
  }
} catch (e) {
  console.warn('[AppInsights] not available:', e.message);
}

function trackConversionEvent(req, details) {
  if (!telemetryClient) return;

  const props = {
    fileName: details.fileName || '',
    status: details.status || '',
    error: details.error ? String(details.error).slice(0, 500) : '',
    userAgent: (req.headers && req.headers['user-agent']) || '',
    clientIp:
      (req.headers && (req.headers['x-forwarded-for'] || req.headers['x-ms-client-ip'])) ||
      ''
  };

  const metrics = {
    durationMs: details.durationMs || 0,
    fileSizeBytes: details.fileSizeBytes || 0
  };

  telemetryClient.trackEvent({
    name: 'Conversion',
    properties: props,
    measurements: metrics
  });
}


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
// --- Actual Function handler (keeps previous logic) ---
module.exports = async function (context, req) {
    const start = Date.now(); // <-- track start time
    let status = 'success';
    let errorText = '';
    let fileName = '';

    try {
        context.log('[function] /api/convert called (debug-mode, requires succeeded)');

        // Expect JSON body: { xmlContent, fileName, metadata }
        const { xmlContent, fileName: reqFileName, metadata } = req.body || {};
        fileName = reqFileName; // capture for telemetry

        if (!xmlContent || !fileName) {
            context.res = { status: 400, body: 'xmlContent and fileName are required (send JSON)' };
            return;
        }

        // Run converters
        const out = await Promise.resolve(customConv.startConversion(xmlContent, fileName, xmlContent.length));
        const prodOut = (await Promise.resolve(
            productConv.productSpConvertionStart(out.format2, out.fileName, out.fileLength, metadata || '')
        )) || { files: [], log_text: '', nonConverted: '' };

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
        status = 'failure';
        errorText = err && err.message ? err.message : String(err);

        const stack = err && err.stack ? err.stack : String(err);
        context.log.error('[function] conversion error:', stack);
        context.res = {
            status: 500,
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            body: `Server debug error:\n\n${stack}`
        };
    } finally {
        // Always track telemetry
        const durationMs = Date.now() - start;
        const fileSizeBytes = (req.body && req.body.xmlContent)
            ? Buffer.byteLength(req.body.xmlContent, 'utf8')
            : 0;

        trackConversionEvent(req, {
            fileName,
            fileSizeBytes,
            durationMs,
            status,
            error: errorText
        });
    }
};

