module.exports = async function (context, req) {
  context.log('HTTP trigger processed a request.');
  const name = (req.query.name || (req.body && req.body.name) || 'world');
  context.res = {
    status: 200,
    body: { message: `Hello, ${name}!` }
  };
};
