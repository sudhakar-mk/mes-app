let spParsedXmlDoc;
let spXmlParser;
let swaggerData = {};
let iFileName;
let collectedFiles = [];
let downloadCount = 0;
const fs = require('fs');
const path = require('path');
const swaggerPath = path.join(__dirname, 'MESSwaggerV3-3.json'); // adjust path if file is elsewhere
const swaggerJson = JSON.parse(fs.readFileSync(swaggerPath, 'utf8'));


function productSpConvertionStart(xmlInputString, inputFileName, inputFileLength) {
  spXmlParser = new DOMParser();
  iFileName = inputFileName;
  // Parse the XML input string
  spParsedXmlDoc = spXmlParser.parseFromString(xmlInputString, 'application/xml');

  // Check for parsing errors
  const spParserErrors = spParsedXmlDoc.getElementsByTagName('parsererror');
  if (spParserErrors.length > 0) {
    console.error("Error parsing XML:", spParserErrors[0].textContent);
    return;
  }

  // Check for 'StartMESTransaction' actions
  const spTransactionActions = Array.from(spParsedXmlDoc.getElementsByTagName('action'))
    .filter(spActionNode => spActionNode.getAttribute('type') === 'StartMESTransaction');

  if (spTransactionActions.length > 0) {
    // Ensure createTransIdXML is defined elsewhere
    const spTransIdXmlOutput = createTransIdXML();
  }

  // Filter actions by relevant types
  const spRelevantActionTypes = ['CommitMESTransaction', 'StartMESTransaction', 'MESXMLCommand', 'RollbackMESTransaction'];
  const spFilteredActionNodes = Array.from(spParsedXmlDoc.getElementsByTagName('action'))
    .filter(spActionNode => spRelevantActionTypes.includes(spActionNode.getAttribute('type')));

  const spTotalActionCount = spFilteredActionNodes.length;
  // Loop through all filtered action nodes
  for (let actionIndex = 0; actionIndex < spFilteredActionNodes.length; actionIndex++) {
    const spCurrentActionNode = spFilteredActionNodes[actionIndex];
    const spCurrentActionName = spCurrentActionNode.getAttribute('name');
    const spCurrentActionType = spCurrentActionNode.getAttribute('type');

    if (spCurrentActionType === 'MESXMLCommand') {
      const spAllActionNodes = spParsedXmlDoc.getElementsByTagName('action');

      for (let innerActionIndex = 0; innerActionIndex < spAllActionNodes.length; innerActionIndex++) {
        const spInnerActionNode = spAllActionNodes[innerActionIndex];
        const spInnerActionName = spInnerActionNode.getAttribute('name');

        if (spInnerActionName === spCurrentActionName) {
          const spApiSpListNode = spInnerActionNode.getElementsByTagName('API_SP_list')[0];
          const spPropertyNodes = spInnerActionNode.getElementsByTagName('property');

          let spVariableCount = 0;

          for (let propIndex = 0; propIndex < spPropertyNodes.length; propIndex++) {
            const spPropertyNode = spPropertyNodes[propIndex];
            const spPropertyName = spPropertyNode.getAttribute('name');

            if (spPropertyName === "Initialize Variable(s)") {
              const spContentUpdationFieldsNodes = spPropertyNode.getElementsByTagName('contentupdationfields');

              if (spContentUpdationFieldsNodes.length > 0) {
                const spContentUpdationFieldList = spContentUpdationFieldsNodes[0].getElementsByTagName('contentupdationfield');
                spVariableCount = spContentUpdationFieldList.length;
              }
            }
          }

          if (spApiSpListNode) {
            const spCdataString = (spApiSpListNode.innerHTML.match(/<!\[CDATA\[(.*?)\]\]>/s)?.[1] || '');

            const spContainsPeriodOrProduct = (spCdataContent) => {
              return spCdataContent.includes('.') ||
                prodspslist.split(',').some(spProductName =>
                  spCdataContent.includes(spProductName.trim()));
            };

            if (!spContainsPeriodOrProduct(spCdataString)) {
            } else {
              addWebApiAndPropertiesForProduct(spCurrentActionName, spCurrentActionType, spVariableCount);
            }
          }
        }
      }
    }
  }
  const serializer = new XMLSerializer();
  const finalXml = serializer.serializeToString(spParsedXmlDoc);
  downloadXML(finalXml, inputFileName, inputFileLength);
}


function addWebApiAndPropertiesForProduct(actionName, type, containsvariables) {
  const serializer = new XMLSerializer();
  const allActions = spParsedXmlDoc.getElementsByTagName("action");

  for (let i = 0; i < allActions.length; i++) {
    const getaction = allActions[i];
    const extractedValues = [];
    const contentUpdateArray = [];
    let outPutDataType;
    let OutPutVariale;
    let transaction = "No";
    let MaximumNumberofRows;

    const currentActionName = getaction.getAttribute("name");
    const currentActionType = getaction.getAttribute("type");

    // Check name and type match
    if (currentActionName === actionName && currentActionType === type) {
      const properties = getaction.getElementsByTagName("properties")[0];

      if (properties) {
        const propertiesXml = serializer.serializeToString(properties);

        // parse XML fragment
        const parser = new DOMParser();
        const propsDoc = parser.parseFromString(propertiesXml, "application/xml");

        const targetNames = [
          "Generate Command",
          "Initialize Variable(s)",
          "Output Data Types",
          "Output Variable",
          "Transaction Participant",
          "Maximum Number of Rows"
        ];

        const namedElements = propsDoc.querySelectorAll("[name]");

        namedElements.forEach(el => {
          const name = el.getAttribute("name");

          if (targetNames.includes(name)) {
            if (name === "Generate Command") {
              const keysToExtract = [
                "API_SP_list",
                "ObjectName",
                "Command",
                "MessageType"
              ];

              keysToExtract.forEach(key => {
                const child = el.querySelector(key);
                if (child) {
                  const value = child.textContent.trim();
                  extractedValues.push({ key, value });
                }
              });
            }
            else if (name === "Initialize Variable(s)") {
              const contentUpdateNodes = el.querySelectorAll("contentupdationfield");
              contentUpdateNodes.forEach(node => {
                const nodeXml = serializer.serializeToString(node);
                contentUpdateArray.push(nodeXml);
              });
            }
            else if (name === "Output Data Types") {
              outPutDataType = el.textContent.trim();
            }
            else if (name === "Output Variable") {
              OutPutVariale = el.textContent.trim();
            }
            else if (name === "Transaction Participant") {
              transaction = el.textContent.trim();
            }
            else if (name === "Maximum Number of Rows") {
              // Check if the attribute exists and is "True"
              const isExpr = el.getAttribute("isexpressionExists");

              if (isExpr && isExpr === "True") {
                // Get the <jsexpression> node inside <expression>
                const jsExprNode = el.querySelector("jsexpression");
                if (jsExprNode) {
                  MaximumNumberofRows = jsExprNode.textContent.trim();
                }
              } else {
                // Fallback: old case
                MaximumNumberofRows = el.textContent.trim();
              }
            }
          }
        });

        // only update if containsvariables matches
        if (propertiesXml.includes(containsvariables)) {
          var objectname = extractedValues[1].value;
          var apiCommend = extractedValues[2].value;
          let swiggerCkeck = CheckSwiggerApiExist(objectname, objectname + "_" + apiCommend);

          if (swiggerCkeck === 'Found') {
            log_text += `\n WorkFlow ${iFileName.replace(/.xml/g, ' ')},Activity ${actionName} with Product Stored Procedure [ ${objectname + "_" + apiCommend} ] is converted to webapi`;
            getaction.setAttribute("type", "Invoke Web API");

            const getWebApiProperties = getProductSpWebApiProperties(
              extractedValues,
              contentUpdateArray,
              outPutDataType,
              OutPutVariale,
              MaximumNumberofRows,
              transaction
            );

            let SPnewPropertyDoc = spXmlParser.parseFromString(getWebApiProperties, "application/xml");
            let SPnewPropertyElement = SPnewPropertyDoc.firstChild;
            let SPimportedElement = xmlDoc.importNode(SPnewPropertyElement, true);

            properties.insertBefore(SPimportedElement, properties.firstChild);

            // Remove nodes not in allowed list
            const allowedNodes = ["configWebAPI", "RaiseError"];
            const children = Array.from(properties.childNodes);

            children.forEach(node => {
              if (node.nodeType === 1) {
                const nodeAttr = node.getAttribute("name");
                if (!allowedNodes.includes(nodeAttr)) {
                  properties.removeChild(node);
                }
              }
            });
          }
          else {
            nonConverted += `\n WorkFlow ${iFileName.replace(/.xml/g, ' ')},Activity ${actionName} Not converted for  Product Stored Procedure    [  ${objectname + "_" + apiCommend} ] Reas: Swagger param not exist `;
          }
        }
      }
    }
  }
  const finalXml = serializer.serializeToString(spParsedXmlDoc);
  return finalXml;
}


function getProductSpWebApiProperties(extractedValues, contentUpdateArray, outPutDataType, OutPutVariale, MaximumNumberofRows, transaction) {
  let AddxmlNodes = `\n<property name="configWebAPI">
                    <classname><![CDATA[`+ processFile(spParsedXmlDoc.toString()) + `]]></classname>
                    <webapiconfig>
                 `;
  let endxmlNodes = `
    \n</property>`;
  let finalxmlNodes = ``;
  var apiCommend = extractedValues[2].value;
  finalxmlNodes += AddxmlNodes;
  if (apiCommend) {
    var GetProdFilterString = getProductAPIFilterString(extractedValues, contentUpdateArray, outPutDataType, OutPutVariale, MaximumNumberofRows, transaction);
    finalxmlNodes += GetProdFilterString;
  }
  finalxmlNodes += endxmlNodes;
  return finalxmlNodes;
}

function getProductAPIFilterString(extractedValues, contentUpdateArray, outPutDataType, OutPutVariale, MaximumNumberofRows, transaction) {
  var endStrinfFilter = `</filter>`;
  var webapiactivityparameters = ``;
  var api = extractedValues[0].value;
  var objectname = extractedValues[1].value;
  var apiCommend = extractedValues[2].value;

  const parser = new DOMParser();
  var AllParams = [];
  var webapiactivityparameters = "";

  contentUpdateArray.forEach(xmlStr => {
    const doc = parser.parseFromString(xmlStr, "application/xml");
    const node = doc.documentElement;

    const mode = node.getAttribute("mode");
    const name = node.getAttribute("name");
    const value = node.textContent.trim();
    const shortName = name.match(/[^.]+$/)[0]; // last part after "."

    // push with mode identifier
    AllParams.push({
      key: shortName,
      value: value,
      mode: mode
    });

    if (apiCommend === "getall" || apiCommend === "getbykey") {
      // still generate XML for Expression / ObjTree
      if (mode === "Expression" || mode === "ObjTree") {
        webapiactivityparameters += `
          <webapiactivityparameters name="${shortName}"><![CDATA[${processFile(spParsedXmlDoc.toString())}]]></webapiactivityparameters>\n`;
      }
    }
    else {
      // still generate XML for Expression / ObjTree
      if (mode === "Expression" || mode === "ObjTree") {

        webapiactivityparameters += `
          <bodyparameters name="${shortName}"><![CDATA[${processFile(spParsedXmlDoc.toString())}]]></bodyparameters>\n`;
      }
    }

  });
  var startStrinFilter = `${webapiactivityparameters + '\n</webapiconfig>'}\n<filter><![CDATA[<WebAPIActivityProperties><WebAPIListItemTitle>${webapiListItemFromJson}</WebAPIListItemTitle><IsOpenApi>true</IsOpenApi><HiddenfieldOperApiUri>file://C:/Program Files/AVEVA/Work Tasks/Resources/WebAPI/MESSwaggerV3-3.json</HiddenfieldOperApiUri>`;


  if (apiCommend === "getall" || apiCommend === "getbykey") {
    var GetHeader = ``;
    if (transaction === "Yes") {
      GetHeader += `<Headers name="trans_id"><![CDATA[${processFile(spParsedXmlDoc.toString())}]]></Headers>\n`
    }
    if (MaximumNumberofRows) {
      try {
        const parsed = JSON.parse(MaximumNumberofRows);
        if (parsed && parsed.DisplayExpressionString) {
          GetHeader += `  <Headers name="max_rows"><![CDATA[${processFile(spParsedXmlDoc.toString())}]]></Headers>\n`
        }
      } catch (e) {
        // Not JSON → Dont set Header for Maxrows
      }
    }

    var contentUpdateString = generateXML(objectname, objectname + "_" + apiCommend, OutPutVariale, AllParams, MaximumNumberofRows, transaction, outPutDataType);
    return GetHeader + startStrinFilter + contentUpdateString + endStrinfFilter;
  }

  else if (apiCommend === "delete") {
    var contentUpdateString = generateXMLDelete(objectname, objectname + "_" + apiCommend, OutPutVariale, AllParams, MaximumNumberofRows, transaction, outPutDataType);
    return webapiactivityparameters + contentUpdateString;

  }
  else {
    var contentUpdateString = generateXMLPostPut(objectname, objectname + "_" + apiCommend, OutPutVariale, AllParams, MaximumNumberofRows, transaction, outPutDataType);
    return webapiactivityparameters + contentUpdateString;

  }

}

function expandSchema(ref, tbody, startIndex) {
  const refName = ref.replace("#/definitions/", "");
  const def = swaggerData.definitions[refName];
  if (def && def.properties) {
    let index = startIndex;
    for (let prop in def.properties) {
      const propDef = def.properties[prop];
      const type = propDef.type || (propDef.$ref ? "object" : "unknown");
      const optional = !(def.required && def.required.includes(prop));
      addRow(tbody, index++, prop, type, optional);
    }
  }
}


function generateXML(manualGroup, manualOperation, OutPutVariale, AllParams, MaximumNumberofRows, transaction, outPutDataType) {


  const group = "V3_" + manualGroup.split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join("");
  const operationId = "V3_MiddlewareAccess_" + manualOperation.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('_');
  const apiCallWithparams = "api/v3/MiddlewareAccess/" + manualOperation.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('.');


  let found = false;
  let operationData = null;
  let httpMethod = "";
  let apiGroup = "";
  let apiOperationGroup = "";

  for (let path in swaggerData.paths) {
    for (let method in swaggerData.paths[path]) {
      let op = swaggerData.paths[path][method];
      if (op.tags && op.tags[0].toUpperCase() === group.toUpperCase() && op.operationId.toUpperCase() === operationId.toUpperCase()) {
        apiGroup = op.tags[0];
        apiOperationGroup = op.operationId;
        found = true;
        operationData = op;
        pathKey = path;
        httpMethod = method[0].toUpperCase() + method.slice(1);
        break;
      }
    }
    if (found) break;
  }

  if (!found) {
    return;
  }

  const baseUri = baseUrl;

  let xml = '';
  xml += `<OperationsGroup>${apiGroup}</OperationsGroup>\n`;
  xml += `<OperationsGroupAPI>${apiOperationGroup}</OperationsGroupAPI>\n`;
  xml += `<TextInputBaseUriAndOperation>${httpMethod}</TextInputBaseUriAndOperation>\n`;
  xml += `<BaseUri>${baseUri}</BaseUri>\n`;
  xml += `<RequestURI></RequestURI>\n`;  // Keeping empty as per your example
  xml += `<HttpMethod>${httpMethod}</HttpMethod>\n`;
  xml += `<ShowHeader>False</ShowHeader>\n`;

  // Helper function to add BaseParameters XML
  function addBaseParameters(xmlStr, idx, param, location) {

    const optional = param.required ? "NO" : "YES";
    const type = param.type || (param.schema ? param.schema.type || "object" : "string");

    let single = AllParams.find(item => item.key === param.name);
    //For Expression and ObjTree mode only
    if (single?.key) {
      var defValueString = `{&quot;ApplicationName&quot;:&quot;${applicationName}&quot;,&quot;WorkflowName&quot;:&quot;${workflowName}&quot;,&quot;FileName&quot;:&quot;1&quot;,&quot;ActionName&quot;:&quot;MESXMLCommand1&quot;,&quot;propertyName&quot;:&quot;configWebAPI&quot;,&quot;ExpressionString&quot;:`;

      if (single.mode === "Expression") {
        // replace quotes with \&quot; and newlines with \n
        let valueString = defValueString + (JSON.stringify(single.value, null, 2)
          .replace(/"/g, '\&quot;')
          .replace(/\n/g, '\\n').replace(/&nbsp;/g, '&amp;nbsp;')) + "}";

        return xmlStr +
          `<BaseParameters>\n` +
          `<TextInputSlNo>${idx}</TextInputSlNo>\n` +
          `<Optional>${optional}</Optional>\n` +
          `<Name>${param.name}</Name>\n` +
          `<HiddenAddtionalInformation>In:${location}</HiddenAddtionalInformation>\n` +
          `<DataType>${type}</DataType>\n` +
          `<ValueExpression isExpression="true">${valueString}</ValueExpression>\n` +
          `</BaseParameters>\n`;
      }

      if (single.mode === "ObjTree") {
        var valueString = "";
        if (/^variable\./i.test(single.value)) {
          valueString = String.raw`&quot;{\&quot;DisplayExpressionString\&quot;:\&quot;${single.value}\&quot;,\n\&quot;ActualExprtessionString\&quot;:\&quot;_context.Variables[\\\&quot;${single.value.match(/[^.]+$/)[0]}\\\&quot;].Value\&quot;,\n\&quot;MethodParameterList\&quot;:\&quot;Workflow.NET.Engine.Context _context\&quot;,\n\&quot;HtmlVerexpString\&quot;:\&quot;${single.value}\&quot;,\n\&quot;ReferenceList\&quot;:\&quot;${referenceListFromJson}[INSTALLDIR]Bin$$Workflow.NET.NET2.dll\&quot;,\n\&quot;ReferencedFunctionList\&quot;:\&quot;\&quot;,\n\&quot;NodeInfo\&quot;:\&quot;${single.value}#_context.Variables[\\\&quot;${single.value.match(/[^.]+$/)[0]}\\\&quot;].Value\&quot;,\n\&quot;ReturnType\&quot;:\&quot;object\&quot;}&quot;}`;
        }
        else if (/^xmlvariables\./i.test(single.value)) {
          const methodvalue = processFile(spParsedXmlDoc.toString());
          valueString = String.raw`&quot;{\&quot;DisplayExpressionString\&quot;:\&quot;${single.value}\&quot;,\n\&quot;ActualExprtessionString\&quot;:\&quot;Method${methodvalue}(_context,\\\&quot;${single.value.replace(/^XmlVariables/, "!!!XmlVar!!!")}\\\&quot;)\&quot;,\n\&quot;MethodParameterList\&quot;:\&quot;Workflow.NET.Engine.Context _context\&quot;,\n\&quot;HtmlVerexpString\&quot;:\&quot;${single.value}\&quot;,\n\&quot;ReferenceList\&quot;:\&quot;${referenceListFromJson}[INSTALLDIR]Bin$$Workflow.NET.NET2.dll\&quot;,\n\&quot;ReferencedFunctionList\&quot;:\&quot;private object  Method${methodvalue}(Workflow.NET.Engine.Context _context,string variableName){\\nstring nodeText = variableName.Substring(13);\\nstring varname = nodeText.Substring(0, nodeText.IndexOf(&apos;.&apos;));\\nstring xpath = nodeText.Substring(nodeText.IndexOf(&apos;.&apos;) + 1);\\nxpath = Workflow.NET.CommonFunctions.EncodeXpath(xpath);xpath = xpath.Replace(&apos;.&apos;, &apos;/&apos;);object[] values = _context.XmlVariables[varname].GetNodeValues(\\\&quot;//\\\&quot; + xpath);\\nif (values == null) values = new object[] { \\\&quot;\\\&quot; };\\nreturn values[0];\\n}\\n\&quot;,\n\&quot;NodeInfo\&quot;:\&quot;${single.value}#Method${methodvalue}(_context,\\\&quot;${single.value.replace(/^XmlVariables/, "!!!XmlVar!!!")}\\\&quot;)\&quot;,\n\&quot;ReturnType\&quot;:\&quot;object\&quot;}&quot;}`;
        }
        return xmlStr +
          `<BaseParameters>\n` +
          `<TextInputSlNo>${idx}</TextInputSlNo>\n` +
          `<Optional>${optional}</Optional>\n` +
          `<Name>${param.name}</Name>\n` +
          `<HiddenAddtionalInformation>In:${location}</HiddenAddtionalInformation>\n` +
          `<DataType>${type}</DataType>\n` +
          `<ValueExpression isExpression="true">${defValueString + valueString}</ValueExpression>\n` +
          `</BaseParameters>\n`;
      }

      if (single.mode === "Default") {
        return xmlStr +
          `<BaseParameters>\n` +
          `<TextInputSlNo>${idx}</TextInputSlNo>\n` +
          `<Optional>${optional}</Optional>\n` +
          `<Name>${param.name}</Name>\n` +
          `<HiddenAddtionalInformation>In:${location}</HiddenAddtionalInformation>\n` +
          `<DataType>${type}</DataType>\n` +
          `<ValueExpression isExpression="false">${single.value}</ValueExpression>\n` +
          `</BaseParameters>\n`;
      }
    }
    else {

      return xmlStr +
        `<BaseParameters>\n` +
        `<TextInputSlNo>${idx}</TextInputSlNo>\n` +
        `<Optional>${optional}</Optional>\n` +
        `<Name>${param.name}</Name>\n` +
        `<HiddenAddtionalInformation>In:${location}</HiddenAddtionalInformation>\n` +
        `<DataType>${type}</DataType>\n` +
        `<ValueExpression isExpression="false"></ValueExpression>\n` +
        `</BaseParameters>\n`;;
    }

  }
  let RequestURIFromApi = apiCallWithparams + `?`;
  // --- Query Parameters ---
  let idx = 1;
  if (operationData.parameters) {
    operationData.parameters.forEach(param => {
      if (param.in === "query") {
        let found = AllParams.find(item => item.key === param.name);
        if (found) {
          var RurlFaApi = `${param.name}={${idx}}&amp;`;
          RequestURIFromApi += RurlFaApi;
        }
        xml = addBaseParameters(xml, idx++, param, "query");
      }
    });
  }
  // --- Body Parameters ---
  if (operationData.parameters) {
    operationData.parameters.forEach(param => {
      if (param.in === "body") {
        // If body uses schema $ref, expand properties
        if (param.schema && param.schema.$ref) {
          const refName = param.schema.$ref.replace("#/definitions/", "");
          const def = swaggerData.definitions[refName];
          if (def && def.properties) {
            for (let prop in def.properties) {
              const propDef = def.properties[prop];
              const optional = !(def.required && def.required.includes(prop)) ? "YES" : "NO";
              const type = propDef.type || "object";
              xml += `<BaseParameters>\n`;
              xml += `<TextInputSlNo>${idx++}</TextInputSlNo>\n`;
              xml += `<Optional>${optional}</Optional>\n`;
              xml += `<Name>${prop}</Name>\n`;
              xml += `<HiddenAddtionalInformation>In:body</HiddenAddtionalInformation>\n`;
              xml += `<DataType>${type}</DataType>\n`;
              xml += `<ValueExpression isExpression="false"></ValueExpression>\n`;
              xml += `</BaseParameters>\n`;
            }
          }
        } else {
          // If no schema ref, just add the parameter itself
          xml = addBaseParameters(xml, idx++, param, "body");
        }
      }
    });
  }


  xml += `<LabelParameterExpression></LabelParameterExpression>\n`;
  xml += `<RadioBodyParameters>Raw</RadioBodyParameters>\n`;
  if (transaction === "Yes" || MaximumNumberofRows) {
    xml += `<BaseformBody><TextInputSlNoBody></TextInputSlNoBody><OptionalBody>YES</OptionalBody><NameBody></NameBody><HiddenAddtionalInformationBody></HiddenAddtionalInformationBody><DataTypeBody>string</DataTypeBody><ValueExpressionBody isExpression="false"></ValueExpressionBody></BaseformBody>\n`;
  }
  xml += `<LabelBodyParameterExpression></LabelBodyParameterExpression>\n`;
  xml += `<ExpressionBodyRaw isExpression="false"></ExpressionBodyRaw>\n`;
  xml += `<HiddenfieldObjectType></HiddenfieldObjectType>\n`;

  // --- Header Parameters ---
  if (operationData.parameters) {
    operationData.parameters.forEach(param => {
      if (param.in === "header") {
        const optional = param.required ? "NO" : "YES";
        xml += `<Headers>\n`;
        xml += `<Optional>${optional}</Optional>\n`;
        xml += `<Key>${param.name}</Key>\n`;
        if (transaction === "Yes" && param.name === "trans_id") {
          var trans_method_Id = 'Method' + (processFile(xmlContent));
          var ValueExpessionString = String.raw`{&quot;ApplicationName&quot;:&quot;${applicationName}&quot;,&quot;WorkflowName&quot;:&quot;${workflowName}&quot;,&quot;FileName&quot;:&quot;1&quot;,&quot;ActionName&quot;:&quot;MESXMLCommand1&quot;,&quot;propertyName&quot;:&quot;${propertyName}&quot;,&quot;ExpressionString&quot;:&quot;{\&quot;DisplayExpressionString\&quot;:\&quot;return XmlVariables.${transidgen}.root.ChildNode.trans_id;\&quot;,\n\&quot;ActualExprtessionString\&quot;:\&quot;return ${trans_method_Id}(_context,\\\&quot;!!!XmlVar!!!.${transidgen}.root.ChildNode.trans_id\\\&quot;);\&quot;,\n\&quot;MethodParameterList\&quot;:\&quot;Workflow.NET.Engine.Context _context\&quot;,\n\&quot;HtmlVerexpString\&quot;:\&quot;return&amp;nbsp;XmlVariables.${transidgen}.root.ChildNode.trans_id;\&quot;,\n\&quot;ReferenceList\&quot;:\&quot;${referenceListFromJson}[INSTALLDIR]Bin$$Workflow.NET.NET2.dll\&quot;,\n\&quot;ReferencedFunctionList\&quot;:\&quot;private object  ${trans_method_Id}(Workflow.NET.Engine.Context _context,string variableName){\\nstring nodeText = variableName.Substring(13);\\nstring varname = nodeText.Substring(0, nodeText.IndexOf(&apos;.&apos;));\\nstring xpath = nodeText.Substring(nodeText.IndexOf(&apos;.&apos;) + 1);\\nxpath = Workflow.NET.CommonFunctions.EncodeXpath(xpath);xpath = xpath.Replace(&apos;.&apos;, &apos;/&apos;);object[] values = _context.XmlVariables[varname].GetNodeValues(\\\&quot;//\\\&quot; + xpath);\\nif (values == null) values = new object[] { \\\&quot;\\\&quot; };\\nreturn values[0];\\n}\\n\&quot;,\n\&quot;NodeInfo\&quot;:\&quot;XmlVariables.${transidgen}.root.ChildNode.trans_id#${trans_method_Id}(_context,\\\&quot;!!!XmlVar!!!.${transidgen}.root.ChildNode.trans_id\\\&quot;)\&quot;,\n\&quot;ReturnType\&quot;:\&quot;object\&quot;}&quot;}`;
          xml += `<Value isExpression="true">${ValueExpessionString}</Value>\n`;
        }
        else if (transaction === "No" && param.name === "trans_id") {
          xml += `<Value isExpression="false"></Value>\n`;
        }
        if (MaximumNumberofRows && param.name === "max_rows") {

          let isExpression = "false";
          let valueContent = MaximumNumberofRows;
          try {
            // Parse the JSON
            const parsed = JSON.parse(MaximumNumberofRows);

            if (parsed && parsed.DisplayExpressionString) {
              var defValueString = `{&quot;ApplicationName&quot;:&quot;${applicationName}&quot;,&quot;WorkflowName&quot;:&quot;${workflowName}&quot;,&quot;FileName&quot;:&quot;1&quot;,&quot;ActionName&quot;:&quot;MESXMLCommand1&quot;,&quot;propertyName&quot;:&quot;configWebAPI&quot;,&quot;ExpressionString&quot;:`;
              var getValueContent = defValueString + (JSON.stringify(MaximumNumberofRows, null, 2)
                .replace(/"/g, '\&quot;')
                .replace(/\n/g, '\\n').replace(/&nbsp;/g, '&amp;nbsp;')) + "}";
              isExpression = "true";
              valueContent = getValueContent;
            }
          } catch (e) {
            // Not JSON → keep default "false"
          }

          xml += `<Value isExpression="${isExpression}">${valueContent}</Value>\n`;
        }

        else if (MaximumNumberofRows == '' || MaximumNumberofRows == 0 && param.name === "max_rows") {
          xml += `<Value isExpression="false"></Value>\n`;
        }
        xml += `</Headers>\n`;
      }
    });
  }
  xml += `<RequestURIFromApi>${removeLastQuestionMark(RequestURIFromApi).replace(/&amp;$/, "")}</RequestURIFromApi>\n`;
  xml += `<PostData isExpression="false"></PostData><ContentType></ContentType><Encoding>UTF-8</Encoding><FromBody>No</FromBody><UserListItemTitle></UserListItemTitle><OutputSaveInType>XmlVariable</OutputSaveInType><OutputSaveIn>${OutPutVariale}</OutputSaveIn></WebAPIActivityProperties>]]>`;

  return xml.replace(/\n/g, "");
}


function removeLastQuestionMark(str) {
  return str.endsWith("?") ? str.slice(0, -1) : str;
}

//Function to convert the Product Sp Post and Put Method
function generateXMLPostPut(manualGroup, manualOperation, OutPutVariale, AllParams, transaction) {

  const group = "V3_" + manualGroup.split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join("");
  const operationId = "V3_MiddlewareAccess_" + manualOperation
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('_');
  const apiCallWithparams = "api/v3/MiddlewareAccess/" + manualOperation
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('.');

  let found = false;
  let operationData = null;
  let pathKey = "";
  let httpMethod = "";
  let apiGroup = "";
  let apiOperationGroup = "";
  for (let path in swaggerData.paths) {
    for (let method in swaggerData.paths[path]) {
      let op = swaggerData.paths[path][method];
      if (op.tags && op.tags[0].toUpperCase() === group.toUpperCase() && op.operationId.toUpperCase() === operationId.toUpperCase()) {
        apiGroup = op.tags[0];
        apiOperationGroup = op.operationId;
        found = true;
        operationData = op;
        pathKey = path;
        httpMethod = method[0].toUpperCase() + method.slice(1);
        break;
      }
    }
    if (found) break;
  }

  if (!found) {
    return;
  }

  const baseUri = baseUrl;
  let xml = ``;

  xml += `<WebAPIActivityProperties>`;
  xml += `<WebAPIListItemTitle>${webapiListItemFromJson}</WebAPIListItemTitle>`;
  xml += `<IsOpenApi>true</IsOpenApi>`;
  xml += `<HiddenfieldOperApiUri>${filePath}</HiddenfieldOperApiUri>`;
  xml += `<OperationsGroup>${apiGroup}</OperationsGroup>`;
  xml += `<OperationsGroupAPI>${apiOperationGroup}</OperationsGroupAPI>`;
  xml += `<TextInputBaseUriAndOperation>${httpMethod}</TextInputBaseUriAndOperation>`;
  xml += `<BaseUri>${baseUri}</BaseUri>`;
  xml += `<RequestURI></RequestURI>`;
  xml += `<HttpMethod>${httpMethod}</HttpMethod>`;
  xml += `<ShowHeader>False</ShowHeader>`;

  // --- Placeholder BaseParameters
  xml += `<BaseParameters>`;
  xml += `<TextInputSlNo></TextInputSlNo>`;
  xml += `<Optional>YES</Optional>`;
  xml += `<Name></Name>`;
  xml += `<HiddenAddtionalInformation></HiddenAddtionalInformation>`;
  xml += `<DataType>string</DataType>`;
  xml += `<ValueExpression isExpression="false"></ValueExpression>`;
  xml += `</BaseParameters>`;

  xml += `<LabelParameterExpression></LabelParameterExpression>`;
  xml += `<RadioBodyParameters>Parameters</RadioBodyParameters>`;

  // --- Body Parameters with value assignment ---
  let idx = 1;
  let RequestURIFromApi = ``;
  if (operationData.parameters) {
    operationData.parameters.forEach(param => {
      const schemaRef = operationData.responses["200"].schema["$ref"].replace("#/definitions/", "");
      if (param.in === "body") {
        if (param.schema && param.schema.$ref) {
          const refName = param.schema.$ref.replace("#/definitions/", "");
          const def = swaggerData.definitions[refName];

          if (def && def.properties) {
            for (let prop in def.properties) {
              const propDef = def.properties[prop];
              const optional = !(def.required && def.required.includes(prop)) ? "YES" : "NO";
              const type = propDef.type || "string";

              let found = AllParams.find(item => item.key === prop);
              if (found) {
                let value;

                if (type === "string" || type === "date-time") {
                  // keep placeholder as string
                  value = `&quot;${prop}&quot;:&quot;{${idx}}&quot;,`;
                } else if (type === "integer" || type === "number" || type === "boolean") {
                  // for numbers and booleans, assign placeholder without converting
                  value = `&quot;${prop}&quot;:{${idx}},`;
                } else {
                  // default fallback
                  value = `{${idx}}`;
                }

                // dynamically assign key-value pair
                RequestURIFromApi += value;
              }
              let single = AllParams.find(item => item.key === prop);
              let valueXml = "";
              var defValueString = `{&quot;ApplicationName&quot;:&quot;${applicationName}&quot;,&quot;WorkflowName&quot;:&quot;${workflowName}&quot;,&quot;FileName&quot;:&quot;1&quot;,&quot;ActionName&quot;:&quot;MESXMLCommand1&quot;,&quot;propertyName&quot;:&quot;configWebAPI&quot;,&quot;ExpressionString&quot;:`;

              if (single?.mode === "Expression") {
                let val = JSON.stringify(single.value)
                  .replace(/"/g, '\&quot;')
                  .replace(/\n/g, '\\n');

                valueXml = `<ValueExpressionBody isExpression="true">${defValueString + val.replace(/&nbsp/g, '&amp;nbsp') + '}'}</ValueExpressionBody>`;
              } else if (single?.mode === "ObjTree") {
                var valueString = "";
                if (/^(?:\s*return\s+)?variable\./i.test(single.value)) {
                  valueString = String.raw`&quot;{\&quot;DisplayExpressionString\&quot;:\&quot;${single.value}\&quot;,\n\&quot;ActualExprtessionString\&quot;:\&quot; _context.Variables[\\\&quot;${single.value.match(/[^.]+$/)[0]}\\\&quot;].Value\&quot;,\n\&quot;MethodParameterList\&quot;:\&quot;Workflow.NET.Engine.Context _context\&quot;,\n\&quot;HtmlVerexpString\&quot;:\&quot;${single.value}\&quot;,\n\&quot;ReferenceList\&quot;:\&quot;${referenceListFromJson}[INSTALLDIR]Bin$$Workflow.NET.NET2.dll\&quot;,\n\&quot;ReferencedFunctionList\&quot;:\&quot;\&quot;,\n\&quot;NodeInfo\&quot;:\&quot;${single.value}#_context.Variables[\\\&quot;${single.value.match(/[^.]+$/)[0]}\\\&quot;].Value\&quot;,\n\&quot;ReturnType\&quot;:\&quot;object\&quot;}&quot;}`;
                }
                else if (/^(?:\s*return\s+)?xmlvariables\./i.test(single.value)) {
                  const methodvalue = processFile(spParsedXmlDoc.toString());
                  valueString = String.raw`&quot;{\&quot;DisplayExpressionString\&quot;:\&quot;${single.value}\&quot;,\n\&quot;ActualExprtessionString\&quot;:\&quot;Method${methodvalue}(_context,\\\&quot;${single.value.replace(/^XmlVariables/, "!!!XmlVar!!!")}\\\&quot;)\&quot;,\n\&quot;MethodParameterList\&quot;:\&quot;Workflow.NET.Engine.Context _context\&quot;,\n\&quot;HtmlVerexpString\&quot;:\&quot;${single.value}\&quot;,\n\&quot;ReferenceList\&quot;:\&quot;${referenceListFromJson}[INSTALLDIR]Bin$$Workflow.NET.NET2.dll\&quot;,\n\&quot;ReferencedFunctionList\&quot;:\&quot;private object  Method${methodvalue}(Workflow.NET.Engine.Context _context,string variableName){\\nstring nodeText = variableName.Substring(13);\\nstring varname = nodeText.Substring(0, nodeText.IndexOf(&apos;.&apos;));\\nstring xpath = nodeText.Substring(nodeText.IndexOf(&apos;.&apos;) + 1);\\nxpath = Workflow.NET.CommonFunctions.EncodeXpath(xpath);xpath = xpath.Replace(&apos;.&apos;, &apos;/&apos;);object[] values = _context.XmlVariables[varname].GetNodeValues(\\\&quot;//\\\&quot; + xpath);\\nif (values == null) values = new object[] { \\\&quot;\\\&quot; };\\nreturn values[0];\\n}\\n\&quot;,\n\&quot;NodeInfo\&quot;:\&quot;${single.value}#Method${methodvalue}(_context,\\\&quot;${single.value.replace(/^XmlVariables/, "!!!XmlVar!!!")}\\\&quot;)\&quot;,\n\&quot;ReturnType\&quot;:\&quot;object\&quot;}&quot;}`;
                }
                valueXml = `<ValueExpressionBody isExpression="true">${defValueString + valueString}</ValueExpressionBody>`;
              } else if (single?.mode === "Default") {
                valueXml = `<ValueExpressionBody isExpression="false">${single.value}</ValueExpressionBody>`;
              }
              else {
                valueXml = `<ValueExpressionBody isExpression="false"></ValueExpressionBody>`;
              }
              xml += `<BaseformBody>`;
              xml += `<TextInputSlNoBody>${idx++}</TextInputSlNoBody>`;
              xml += `<OptionalBody>${optional}</OptionalBody>`;
              xml += `<NameBody>${prop}</NameBody>`;
              xml += `<HiddenAddtionalInformationBody>In:body</HiddenAddtionalInformationBody>`;
              xml += `<DataTypeBody>${type}</DataTypeBody>`;
              xml += valueXml;
              xml += `</BaseformBody>`;
            }
          }

          xml += `<LabelBodyParameterExpression></LabelBodyParameterExpression>`;
          xml += `<ExpressionBodyRaw isExpression="false"></ExpressionBodyRaw>`;
          xml += `<HiddenfieldObjectType>${schemaRef}</HiddenfieldObjectType>`;
        }
      }
    });
  }

  // --- Header Parameters ---
  if (operationData.parameters) {
    operationData.parameters.forEach(param => {
      if (param.in === "header") {
        const optional = param.required ? "NO" : "YES";
        xml += `<Headers>`;
        xml += `<Optional>${optional}</Optional>`;
        xml += `<Key>${param.name}</Key>`;

        //Handle for transaction handling
        if (transaction === "Yes") {
          var trans_method_Id = 'Method' + (processFile(xmlContent));
          var ValueExpessionString = String.raw`{&quot;ApplicationName&quot;:&quot;${applicationName}&quot;,&quot;WorkflowName&quot;:&quot;${workflowName}&quot;,&quot;FileName&quot;:&quot;1&quot;,&quot;ActionName&quot;:&quot;MESXMLCommand1&quot;,&quot;propertyName&quot;:&quot;${propertyName}&quot;,&quot;ExpressionString&quot;:&quot;{\&quot;DisplayExpressionString\&quot;:\&quot;return XmlVariables.${transidgen}.root.ChildNode.trans_id;\&quot;,\n\&quot;ActualExprtessionString\&quot;:\&quot;return ${trans_method_Id}(_context,\\\&quot;!!!XmlVar!!!.${transidgen}.root.ChildNode.trans_id\\\&quot;);\&quot;,\n\&quot;MethodParameterList\&quot;:\&quot;Workflow.NET.Engine.Context _context\&quot;,\n\&quot;HtmlVerexpString\&quot;:\&quot;return&amp;nbsp;XmlVariables.${transidgen}.root.ChildNode.trans_id;\&quot;,\n\&quot;ReferenceList\&quot;:\&quot;${referenceListFromJson}[INSTALLDIR]Bin$$Workflow.NET.NET2.dll\&quot;,\n\&quot;ReferencedFunctionList\&quot;:\&quot;private object  ${trans_method_Id}(Workflow.NET.Engine.Context _context,string variableName){\\nstring nodeText = variableName.Substring(13);\\nstring varname = nodeText.Substring(0, nodeText.IndexOf(&apos;.&apos;));\\nstring xpath = nodeText.Substring(nodeText.IndexOf(&apos;.&apos;) + 1);\\nxpath = Workflow.NET.CommonFunctions.EncodeXpath(xpath);xpath = xpath.Replace(&apos;.&apos;, &apos;/&apos;);object[] values = _context.XmlVariables[varname].GetNodeValues(\\\&quot;//\\\&quot; + xpath);\\nif (values == null) values = new object[] { \\\&quot;\\\&quot; };\\nreturn values[0];\\n}\\n\&quot;,\n\&quot;NodeInfo\&quot;:\&quot;XmlVariables.${transidgen}.root.ChildNode.trans_id#${trans_method_Id}(_context,\\\&quot;!!!XmlVar!!!.${transidgen}.root.ChildNode.trans_id\\\&quot;)\&quot;,\n\&quot;ReturnType\&quot;:\&quot;object\&quot;}&quot;}`;
          xml += `<Value isExpression="true">${ValueExpessionString}</Value>`;
        }
        else {
          xml += `<Value isExpression="false"></Value>`;
        }
        xml += `</Headers>`;
      }
    });
  }

  xml += `<RequestURIFromApi>${apiCallWithparams}</RequestURIFromApi>`;
  xml += `<PostData isExpression="false">{${(RequestURIFromApi).slice(0, -1)}}</PostData>`;
  xml += `<ContentType>application/json</ContentType>`;
  xml += `<Encoding>UTF-8</Encoding>`;
  xml += `<FromBody>No</FromBody>`;
  xml += `<UserListItemTitle></UserListItemTitle>`;
  xml += `<OutputSaveInType>XmlVariable</OutputSaveInType>`;
  xml += `<OutputSaveIn>${OutPutVariale || ""}</OutputSaveIn>`;
  xml += `</WebAPIActivityProperties>`;

  if (transaction === "Yes") {
    var transactionHeader = `<Headers name="trans_id"><![CDATA[${processFile(spParsedXmlDoc.toString())}]]></Headers>`
    return `${transactionHeader}</webapiconfig>\n<filter><![CDATA[${xml}]]></filter>`;
  }
  else {
    return `</webapiconfig>\n<filter><![CDATA[${xml}]]></filter>`;
  }

}

function generateXMLDelete(manualGroup, manualOperation, OutPutVariale, AllParams, MaximumNumberofRows, transaction, outPutDataType) {
  const group = "V3_" + manualGroup.split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join("");
  const operationId = "V3_MiddlewareAccess_" + manualOperation
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('_');
  const apiCallWithparams = "api/v3/MiddlewareAccess/" + manualOperation
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('.');

  let found = false;
  let operationData = null;
  let pathKey = "";
  let httpMethod = "";
  let apiGroup;
  let apiOperationGroup;

  for (let path in swaggerData.paths) {
    for (let method in swaggerData.paths[path]) {
      let op = swaggerData.paths[path][method];
      if (op.tags && op.tags[0].toUpperCase() === group.toUpperCase() && op.operationId.toUpperCase() === operationId.toUpperCase()) {
        found = true;
        apiGroup = op.tags[0];
        apiOperationGroup = op.operationId;
        operationData = op;
        pathKey = path;
        httpMethod = method[0].toUpperCase() + method.slice(1);
        break;
      }
    }
    if (found) break;
  }

  const baseUri = baseUrl;
  let xml = ``;

  xml += `<WebAPIActivityProperties>`;
  xml += `<WebAPIListItemTitle>${webapiListItemFromJson}</WebAPIListItemTitle>`;
  xml += `<IsOpenApi>true</IsOpenApi>`;
  xml += `<HiddenfieldOperApiUri>${filePath}</HiddenfieldOperApiUri>`;
  xml += `<OperationsGroup>${apiGroup}</OperationsGroup>`;
  xml += `<OperationsGroupAPI>${apiOperationGroup}</OperationsGroupAPI>`;
  xml += `<TextInputBaseUriAndOperation>${httpMethod}</TextInputBaseUriAndOperation>`;
  xml += `<BaseUri>${baseUri}</BaseUri>`;
  xml += `<RequestURI></RequestURI>`;
  xml += `<HttpMethod>${httpMethod}</HttpMethod>`;
  xml += `<ShowHeader>False</ShowHeader>`;

  // --- Query Parameters ---
  let idx = 1;
  let RequestURIFromApi = apiCallWithparams + `?`;

  if (operationData.parameters) {
    operationData.parameters.forEach(param => {


      let found = AllParams.find(item => item.key === param.name);
      if (found) {
        var RurlFaApi = `${param.name}={${idx}}&amp;`;
        RequestURIFromApi += RurlFaApi;
      }
      let single = AllParams.find(item => item.key === param.name);
      let valueXml = "";
      var defValueString = `{&quot;ApplicationName&quot;:&quot;${applicationName}&quot;,&quot;WorkflowName&quot;:&quot;${workflowName}&quot;,&quot;FileName&quot;:&quot;1&quot;,&quot;ActionName&quot;:&quot;MESXMLCommand1&quot;,&quot;propertyName&quot;:&quot;configWebAPI&quot;,&quot;ExpressionString&quot;:`;

      if (single?.mode === "Expression") {
        let val = JSON.stringify(single.value, null, 2)
          .replace(/"/g, '\&quot;')
          .replace(/\n/g, '\\n');
        valueXml = `<ValueExpression isExpression="true">${defValueString + val}</ValueExpression>`;
      } else if (single?.mode === "ObjTree") {
        var valueString = "";
        if (/^variable\./i.test(single.value)) {
          valueString = String.raw`&quot;{\&quot;DisplayExpressionString\&quot;:\&quot;${single.value}\&quot;,\n\&quot;ActualExprtessionString\&quot;:\&quot;_context.Variables[\\\&quot;${single.value.match(/[^.]+$/)[0]}\\\&quot;].Value\&quot;,\n\&quot;MethodParameterList\&quot;:\&quot;Workflow.NET.Engine.Context _context\&quot;,\n\&quot;HtmlVerexpString\&quot;:\&quot;${single.value}\&quot;,\n\&quot;ReferenceList\&quot;:\&quot;${referenceListFromJson}[INSTALLDIR]Bin$$Workflow.NET.NET2.dll\&quot;,\n\&quot;ReferencedFunctionList\&quot;:\&quot;\&quot;,\n\&quot;NodeInfo\&quot;:\&quot;${single.value}#_context.Variables[\\\&quot;${single.value.match(/[^.]+$/)[0]}\\\&quot;].Value\&quot;,\n\&quot;ReturnType\&quot;:\&quot;object\&quot;}&quot;}`;
        }
        else if (/^xmlvariables\./i.test(single.value)) {
          const methodvalue = processFile(spParsedXmlDoc.toString());
          valueString = String.raw`&quot;{\&quot;DisplayExpressionString\&quot;:\&quot;${single.value}\&quot;,\n\&quot;ActualExprtessionString\&quot;:\&quot;Method${methodvalue}(_context,\\\&quot;${single.value.replace(/^XmlVariables/, "!!!XmlVar!!!")}\\\&quot;)\&quot;,\n\&quot;MethodParameterList\&quot;:\&quot;Workflow.NET.Engine.Context _context\&quot;,\n\&quot;HtmlVerexpString\&quot;:\&quot;${single.value}\&quot;,\n\&quot;ReferenceList\&quot;:\&quot;${referenceListFromJson}[INSTALLDIR]Bin$$Workflow.NET.NET2.dll\&quot;,\n\&quot;ReferencedFunctionList\&quot;:\&quot;private object  Method${methodvalue}(Workflow.NET.Engine.Context _context,string variableName){\\nstring nodeText = variableName.Substring(13);\\nstring varname = nodeText.Substring(0, nodeText.IndexOf(&apos;.&apos;));\\nstring xpath = nodeText.Substring(nodeText.IndexOf(&apos;.&apos;) + 1);\\nxpath = Workflow.NET.CommonFunctions.EncodeXpath(xpath);xpath = xpath.Replace(&apos;.&apos;, &apos;/&apos;);object[] values = _context.XmlVariables[varname].GetNodeValues(\\\&quot;//\\\&quot; + xpath);\\nif (values == null) values = new object[] { \\\&quot;\\\&quot; };\\nreturn values[0];\\n}\\n\&quot;,\n\&quot;NodeInfo\&quot;:\&quot;${single.value}#Method${methodvalue}(_context,\\\&quot;${single.value.replace(/^XmlVariables/, "!!!XmlVar!!!")}\\\&quot;)\&quot;,\n\&quot;ReturnType\&quot;:\&quot;object\&quot;}&quot;}`;
        }
        valueXml = `<ValueExpression isExpression="true">${defValueString + valueString}</ValueExpression>`;
      } else if (single?.mode === "Default") {
        valueXml = `<ValueExpression isExpression="false">${single.value}</ValueExpression>`;
      }
      else {
        valueXml = `<ValueExpression isExpression="false"></ValueExpression>`;
      }

      if (param.in === "query") {
        const optional = param.required ? "NO" : "YES";
        const type = param.type || "string";

        xml += `<BaseParameters>`;
        xml += `<TextInputSlNo>${idx++}</TextInputSlNo>`;
        xml += `<Optional>${optional}</Optional>`;
        xml += `<Name>${param.name}</Name>`;
        xml += `<HiddenAddtionalInformation>In:query</HiddenAddtionalInformation>`;
        xml += `<DataType>${type}</DataType>`;
        xml += valueXml;
        xml += `</BaseParameters>`;
      }
    });
  }

  xml += `<LabelParameterExpression></LabelParameterExpression>`;
  xml += `<RadioBodyParameters>Raw</RadioBodyParameters>`;
  // For transaction handling
  if (transaction === "Yes") {
    xml += `<BaseformBody><TextInputSlNoBody></TextInputSlNoBody><OptionalBody>YES</OptionalBody><NameBody></NameBody><HiddenAddtionalInformationBody></HiddenAddtionalInformationBody><DataTypeBody>string</DataTypeBody><ValueExpressionBody isExpression="false"></ValueExpressionBody></BaseformBody>`;
  }
  xml += `<LabelBodyParameterExpression></LabelBodyParameterExpression>`;
  xml += `<ExpressionBodyRaw isExpression="false"></ExpressionBodyRaw>`;
  xml += `<HiddenfieldObjectType></HiddenfieldObjectType>`;

  // --- Header Parameters ---
  if (operationData.parameters) {
    operationData.parameters.forEach(param => {
      if (param.in === "header") {
        const optional = param.required ? "NO" : "YES";
        xml += `<Headers>`;
        xml += `<Optional>${optional}</Optional>`;
        xml += `<Key>${param.name}</Key>`;
        //For transaction handling
        if (transaction === "Yes") {
          var trans_method_Id = 'Method' + (processFile(xmlContent));
          var ValueExpessionString = String.raw`{&quot;ApplicationName&quot;:&quot;${applicationName}&quot;,&quot;WorkflowName&quot;:&quot;${workflowName}&quot;,&quot;FileName&quot;:&quot;1&quot;,&quot;ActionName&quot;:&quot;MESXMLCommand1&quot;,&quot;propertyName&quot;:&quot;${propertyName}&quot;,&quot;ExpressionString&quot;:&quot;{\&quot;DisplayExpressionString\&quot;:\&quot;return XmlVariables.${transidgen}.root.ChildNode.trans_id;\&quot;,\n\&quot;ActualExprtessionString\&quot;:\&quot;return ${trans_method_Id}(_context,\\\&quot;!!!XmlVar!!!.${transidgen}.root.ChildNode.trans_id\\\&quot;);\&quot;,\n\&quot;MethodParameterList\&quot;:\&quot;Workflow.NET.Engine.Context _context\&quot;,\n\&quot;HtmlVerexpString\&quot;:\&quot;return&amp;nbsp;XmlVariables.${transidgen}.root.ChildNode.trans_id;\&quot;,\n\&quot;ReferenceList\&quot;:\&quot;${referenceListFromJson}[INSTALLDIR]Bin$$Workflow.NET.NET2.dll\&quot;,\n\&quot;ReferencedFunctionList\&quot;:\&quot;private object  ${trans_method_Id}(Workflow.NET.Engine.Context _context,string variableName){\\nstring nodeText = variableName.Substring(13);\\nstring varname = nodeText.Substring(0, nodeText.IndexOf(&apos;.&apos;));\\nstring xpath = nodeText.Substring(nodeText.IndexOf(&apos;.&apos;) + 1);\\nxpath = Workflow.NET.CommonFunctions.EncodeXpath(xpath);xpath = xpath.Replace(&apos;.&apos;, &apos;/&apos;);object[] values = _context.XmlVariables[varname].GetNodeValues(\\\&quot;//\\\&quot; + xpath);\\nif (values == null) values = new object[] { \\\&quot;\\\&quot; };\\nreturn values[0];\\n}\\n\&quot;,\n\&quot;NodeInfo\&quot;:\&quot;XmlVariables.${transidgen}.root.ChildNode.trans_id#${trans_method_Id}(_context,\\\&quot;!!!XmlVar!!!.${transidgen}.root.ChildNode.trans_id\\\&quot;)\&quot;,\n\&quot;ReturnType\&quot;:\&quot;object\&quot;}&quot;}`;
          xml += `<Value isExpression="true">${ValueExpessionString}</Value>`;
        }
        else {
          xml += `<Value isExpression="false"></Value>`;
        }
        xml += `</Headers>`;
      }
    });
  }

  xml += `<RequestURIFromApi>${removeLastQuestionMark(RequestURIFromApi).replace(/&amp;$/, "")}</RequestURIFromApi>`;
  xml += `<PostData isExpression="false"></PostData>`;
  xml += `<ContentType></ContentType>`;
  xml += `<Encoding>UTF-8</Encoding>`;
  xml += `<FromBody>No</FromBody>`;
  xml += `<UserListItemTitle></UserListItemTitle>`;
  xml += `<OutputSaveInType>XmlVariable</OutputSaveInType>`;
  xml += `<OutputSaveIn>${OutPutVariale || ""}</OutputSaveIn>`;
  xml += `</WebAPIActivityProperties>`;

  if (transaction === "Yes") {
    var transactionHeader = `<Headers name="trans_id"><![CDATA[${processFile(spParsedXmlDoc.toString())}]]></Headers>`
    return `${transactionHeader}</webapiconfig>\n<filter><![CDATA[${xml}]]></filter>`;
  }
  else {
    return `</webapiconfig>\n<filter><![CDATA[${xml}]]></filter>`;
  }
}

function downloadXML(format2, fileName, fileLength) {
  
 try {
    const filename = (fileName && fileName.toLowerCase().endsWith('.xml')) ? fileName : `${fileName}.xml`;
    collectedFiles.push({ name: filename, content: format2 });
    downloadCount++;
  } catch (e) {
    console.error('[product_sp_convert] downloadXML collect error', e);
  }
}

function zipFilesReset() {
  // Reset collection and counters (keeps same semantics as old reset)
  collectedFiles = [];
  downloadCount = 0;
  log_text = ``;
  nonConverted = ``;
}


function CheckSwiggerApiExist(manualGroup, manualOperation) {
  const group = "V3_" + manualGroup
    .split("_")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");

  const operationId = "V3_MiddlewareAccess_" + manualOperation
    .split("_")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join("_");

  for (let path in swaggerData.paths) {
    for (let method in swaggerData.paths[path]) {
      let op = swaggerData.paths[path][method];

      if (
        op.tags &&
        op.tags[0].toUpperCase() === group.toUpperCase() &&
        op.operationId.toUpperCase() === operationId.toUpperCase()
      ) {
        if (op.parameters) {
          for (let param of op.parameters) {
            if (param.in === "body") {
              if (param.schema && param.schema.$ref) {
                const refName = param.schema.$ref.replace("#/definitions/", "");
                const def = swaggerData.definitions[refName];

                if (def && def.properties && Object.keys(def.properties).length > 0) {
                  return "Found";
                }
              }
            }
            else if (param.in === "query") {
              return "Found";
            }
          }
        }
      }
    }
  }
  return "Not Found";
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    productSpConvertionStart
  };
}


