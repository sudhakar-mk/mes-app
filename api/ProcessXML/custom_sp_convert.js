


//Config 
let referenceListFromJson = ``;
let webapiListItemFromJson = '';
let CustomSpXmlStractureFromJson;
let filePath = ``;
let baseUrl = ``;
let applicationName = 'SkeltaRepo';


let log_text = ``;
let nonConverted = ``;
let xmlDoc;
let xmlContent;

// FOR FILTER FUNCTION
let workflowName = 'TestWF';
let propertyName = 'configWebAPI';
// FOR JSONTEMP()
let jsonString = "";

//FOR TRANS_ID FUNCTION

let xmlString = "";
let transidgen = "";
let createTransIdXMLOutput = "";
let elementNameTransId = "trans_id";
let elementNameTransStartUtc = "trans_start_utc";

// READ XML FILE 
let spName;
let parameters = '';
let paramValues = '';
let modifiedXML;

let finalDisplayExpression = '';
let finalActualExpressionString = '';
let finalHtmlVerexpString;
let finalNodeInfo = '';
let finalreferencedFunctionList = '';
let generatedStrings = new Set();
let actioncontainsvariables;

let startString = String.raw`return \"{`;
let endString = String.raw`}\";`;
//WEBAPI 
let prodspslist = '';
let relaceXmlvariableStracture = [];
let format2 = '';

//put activity counts in console
let activityTotalCount = 0;
let activitycount = 0;
let startTime = '';
let startTimeStr = '';
let endTime = '';
let endTimeStr = '';


function loadAndDisplay() {
    startTime = new Date();
    startTimeStr = startTime.toLocaleTimeString().replace(/ AM| PM/g, '') + '.' + startTime.getMilliseconds();
    productSpListload();
    loadReferenceJson();
    readXML();
}


//FUNCTION TO READ XML FILE 
function readXML() {
    const fileInput = document.getElementById('xmlFileInput');
    const files = fileInput.files; // Get all selected files
    const fileLength = files.length;

    if (files.length > 0) {
        // Loop through each file
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const reader = new FileReader();

            reader.onload = function (event) {
                xmlContent = event.target.result; // Get the content of the file
                const fileName = file.name; // Get the file name
                startConversion(xmlContent, fileName, fileLength); // Pass both content and file name
            };

            reader.onerror = function (error) {
                alert('Error reading file: ' + file.name);
            };

            reader.readAsText(file); // Read the file as text
        }
    } else {
        showConversionError("Please select a Xml file!");
    }
}

// Function to load the product list (using XMLHttpRequest)
function productSpListload() {
    const filePath = './productsplist.txt';
    const xhr = new XMLHttpRequest();
    xhr.open('GET', filePath, false);
    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
            if (xhr.status === 200) {
                prodspslist = xhr.responseText;
            } else {
                console.error(`Error loading file: ${xhr.status}`);
            }
        }
    };
    xhr.send();
}


// Function to load the ReferenceJson From User Input:
function loadReferenceJson() {
    const jsonFileInput = document.getElementById("referenceJson").files[0];

    if (!jsonFileInput) {
        showConversionError("Please select a JSON file!");
        return;
    }

    const reader = new FileReader();
    reader.onload = function (event) {
        try {
            // Parse JSON
            referenceData = JSON.parse(event.target.result);
            console.log(referenceData);
            referenceListFromJson = referenceData[0].ReferenceList;
            filePath = referenceData[0].SwiggerJsonPath;
            baseUrl = referenceData[0].BaseUrl;
            webapiListItemFromJson = referenceData[0].WebApiListItem;
            applicationName = referenceData[0].RepositoryName;
            CustomSpXmlStractureFromJson = referenceData[0].CustomSpXmlStracture;
            showConversionStarted();
        } catch (err) {
            showConversionError(err);
            console.error("Invalid JSON file:", err);
            return;
        }
    };
    reader.readAsText(jsonFileInput);
}


//FUNCTION THAT LOOPS THE ACTION ,SAVES XMLDOC IN GLOBAL , DISPLAY THE CONTENT 
function startConversion(xmlContent, fileName, fileLength) {
    const parser = new DOMParser();
    let containsvariables;
    xmlDoc = parser.parseFromString(xmlContent, 'application/xml');
    const containstransaction = Array.from(xmlDoc.getElementsByTagName('action')).filter(action => ['StartMESTransaction'].includes(action.getAttribute('type')));
    if (containstransaction.length > 0) {
        createTransIdXMLOutput = createTransIdXML();
    }
    const filteredActions = Array.from(xmlDoc.getElementsByTagName('action')).filter(action => ['CommitMESTransaction', 'StartMESTransaction', 'MESXMLCommand', 'RollbackMESTransaction'].includes(action.getAttribute('type')));
    activityTotalCount = filteredActions.length;
    // Loop through all action elements
    for (let i = 0; i < filteredActions.length; i++) {
        var action = filteredActions[i].getAttribute('name');
        var type = filteredActions[i].getAttribute('type');
        if (type === 'MESXMLCommand') {
            const actions = xmlDoc.getElementsByTagName('action');
            for (let i = 0; i < actions.length; i++) {
                const actionElement = actions[i];
                const actiontype = actionElement.getAttribute('type');
                if (actionElement.getAttribute('name') === action) {
                    const apiSpListElement = (actionElement.getElementsByTagName('API_SP_list')[0]);
                    const transactionParticipantElement = actionElement.querySelector('property[name="Transaction Participant"]');
                    const properties = actionElement.getElementsByTagName('property');
                    for (let j = 0; j < properties.length; j++) {
                        const property = properties[j];
                        const propertyName = property.getAttribute('name');
                        const propertyValue = property.textContent.trim();
                        if (propertyName === "Initialize Variable(s)") {
                            // Get contentupdationfields element if it exists
                            const contentUpdationFields = property.getElementsByTagName('contentupdationfields');
                            if (contentUpdationFields.length > 0) {
                                // Get all contentupdationfield elements
                                const contentUpdationFieldElements = contentUpdationFields[0].getElementsByTagName('contentupdationfield');
                                containsvariables = contentUpdationFieldElements.length;

                            }
                        }
                    }
                    if (apiSpListElement) {
                        const fstring = (apiSpListElement.innerHTML.match(/<!\[CDATA\[(.*?)\]\]>/s)?.[1] || '');

                        const containsPeriodOrProduct = (fstring) => {
                            return fstring.includes('.') || prodspslist.split(',').some(product => fstring.includes(product.trim()));
                        };
                        if (!containsPeriodOrProduct(fstring)) {

                            addWebApiAndProperties(action, type, containsvariables, fileName, fstring);

                        }
                    }
                }
            }
        }

        if (type === 'StartMESTransaction') {
            const apiSpListElement = "Start Transaction"
            const containsvariable = 1;
            appendStartTransIdVariables();
            addWebApiAndProperties(action, type, containsvariable, fileName, apiSpListElement);

        }
        if (type === 'CommitMESTransaction' || type === 'RollbackMESTransaction') {
            const apiSpListElement = "Commit / Rollback Transaction"
            const containsvariable = 1;
            addWebApiAndProperties(action, type, containsvariable, fileName, apiSpListElement);

        }
    }

    removeGenerateCommandElements(xmlDoc);
    const serializer = new XMLSerializer();
    const modifiedXML = serializer.serializeToString(xmlDoc);
    const format = modifiedXML.replace(/^\s*[\r\n]/gm, '');
    if (relaceXmlvariableStracture.length > 0) {
        for (let i of relaceXmlvariableStracture) {
            const regex = new RegExp(`xmlvariables\\.${i}\\.response\\.|xmlvariables\\.${i}\\.NewDataSet\\.SQL\\.|\\/response\\/|\\/NewDataSet\\/SQL\\/`, "g");
            format2 = format.replace(regex, match => {
                if (match === `xmlvariables.${i}.response.`) {
                    return `xmlvariables.${i}.root.response.`;
                } else if (match === `xmlvariables.${i}.NewDataSet.SQL.`) {
                    return `xmlvariables.${i}.root.`;
                } else if (match === "/response/") {
                    return "/root/response/";
                } else if (match === "/NewDataSet/SQL/") {
                    return "/root/";
                }
            });
        }
    }
    else {
        format2 = format;
    }

    endTime = new Date();
    endTimeStr = endTime.toLocaleTimeString().replace(/ AM| PM/g, '') + '.' + endTime.getMilliseconds();
    let timeDiff = endTime - startTime;

    activityTotalCount = 0;
    activitycount = 0;

    //productSpConvertionStart(format2,fileName,fileLength)

    return {
        format2: format2,
        fileName: fileName,
        fileLength: fileLength,
        log_text: typeof log_text !== 'undefined' ? log_text : '',
        nonConverted: typeof nonConverted !== 'undefined' ? nonConverted : ''
    };

}

//ADD PROPERTIES FUNCTION 
function addWebApiAndProperties(actionName, type, containsvariables, fileName, apiSpListElement) {
    log_text += `\n WorkFlow ${fileName.replace(/.xml/g, ' ')},Activity ${actionName} with Custom Stored Procedure ${apiSpListElement} is converted to webapi`;
    activitycount = activitycount + 1;
    var filterTagCall = getFilterTag(actionName);
    var filterValue = filterTagCall.filterString;
    var ispartOfTransactionFinal = filterTagCall.ispartOfTransactionPass;
    var apiTypeFinal = filterTagCall.apitypePass;

    apiTypeFinal = apiTypeFinal ? apiTypeFinal.textContent.trim() : 'undefined';

    var actionElements = xmlDoc.querySelector(`action[name="${actionName}"]`);

    if (actionElements) {
        const properties = actionElements.querySelector('properties');

        if (properties) {
            var xmlString = `
                        <property name="Allow Specific Error Outputs?"><![CDATA[No]]></property>
                    `;
            var parser = new DOMParser();
            var newPropertyDoc = parser.parseFromString(xmlString, 'application/xml');
            var newPropertyElement = newPropertyDoc.firstChild;
            var importedElement = xmlDoc.importNode(newPropertyElement, true);
            properties.insertBefore(importedElement, properties.firstChild);

            var str = '';
            switch (type) {
                case 'StartMESTransaction':
                    str = '<webapiconfig/>\n';
                    break;

                case 'CommitMESTransaction':
                case 'RollbackMESTransaction':
                    str = `<webapiconfig>\n
                                <Headers name="trans_id"><![CDATA[${processFile(xmlContent)}]]></Headers>\n
                            </webapiconfig>\n`;
                    break;

                case 'MESXMLCommand':
                    if (containsvariables > 0) {
                        str = `<webapiconfig>\n`;
                        if (apiTypeFinal.toLowerCase() === 'getbykey' || apiTypeFinal.toLowerCase() === 'getall') {
                            str += `
                                <webapiactivityparameters name="spParams"><![CDATA[${processFile(xmlContent)}]]></webapiactivityparameters>\n
                                `;
                        }
                        else {
                            str += `
                                <dynamicmethodnameforpostdata><![CDATA[${processFile(xmlContent)}]]></dynamicmethodnameforpostdata>\n
                                `;
                        }
                        if (ispartOfTransactionFinal === 'Yes' || type === 'CommitMESTransaction') {
                            str += `
                                <Headers name="trans_id"><![CDATA[${processFile(xmlContent)}]]></Headers>\n
                                `;
                        }
                        str += `
                            </webapiconfig>\n
                            `;
                    }
                    else {
                        str = `
                            <webapiconfig />\n
                            `;
                    }
                    break;

            }

            xmlString = `
                        <property name="configWebAPI">
                            <classname><![CDATA[${processFile(xmlContent)}]]></classname>\n
                            ${str}
                            <filter><![CDATA[${filterValue}]]></filter>\n
                        </property>\n
                    `;

            parser = new DOMParser();
            newPropertyDoc = parser.parseFromString(xmlString, 'application/xml');
            newPropertyElement = newPropertyDoc.firstChild;
            importedElement = xmlDoc.importNode(newPropertyElement, true);
            properties.insertBefore(importedElement, properties.firstChild);

        } else {
            console.error('<properties> element not found inside action:', actionName);
        }
    } else {
        console.error(`Action with name "${actionName}" not found.`);
    }
}

//FOR 32 DIGIT CODE//
function processFile(inputText) {
    var inputdata = inputText;
    var characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
    do {
        newGUID = '';
        for (let i = 0; i < 32; i++) {
            var randomIndex = Math.floor(Math.random() * characters.length);
            newGUID += characters[randomIndex];
        }
    } while (inputdata.includes(newGUID) || generatedStrings.has(newGUID));
    generatedStrings.add(newGUID);
    return newGUID;
}

//TRANS_ID FUNCTION
function createTransIdXML() {

    const nameElements = xmlDoc.getElementsByTagName("Name");

    const names = [];

    for (let i = 0; i < nameElements.length; i++) {
        names.push(nameElements[i].textContent);
    }

    let transid = names.filter(name => name === "TransId").sort();


    if (transid.length === 0) {
        transidgen = 'TransId';
    } else {
        let transidNumbers = names.filter(name => name.includes("TransId"))
            .map(name => {
                let match = name.match(/\d+/);
                return match ? parseInt(match[0], 10) : null;
            })
            .filter(number => number !== null);

        transidNumbers.sort((a, b) => a - b);


        if (transidNumbers.length === 1 && transidNumbers[0] !== 1) {
            transidgen = 'TransId1';
        }
        else if (transidNumbers.length === 0) {
            transidgen = 'TransId1';
        }
        else {
            let smallest = transidNumbers[0];
            let largest = transidNumbers[transidNumbers.length - 1];

            let fullRange = [];
            for (let i = smallest; i <= largest; i++) {
                fullRange.push(i);
            }

            let missingNumbers = fullRange.filter(num => !transidNumbers.includes(num));
            let firstMissingNumber = missingNumbers.length > 0 ? missingNumbers[0] : null;

            if (missingNumbers.length === 0) {
                transidgen = 'TransId' + (largest + 1);
            } else {
                transidgen = 'TransId' + firstMissingNumber;
            }
        }
    }

    const elementNameTransId = "trans_id";
    const elementNameTransStartUtc = "trans_start_utc";

    xmlString = `
        <XmlVariable>
                <Name><![CDATA[${transidgen}]]></Name>  
                <Description><![CDATA[]]></Description>
                <StorageType><![CDATA[XmlDocument]]></StorageType>
                <Scope><![CDATA[global]]></Scope>
                
                <Schema><![CDATA[<?xml version="1.0" encoding="utf-16"?>
                    <xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
                        <xs:element name="root">
                            <xs:complexType>
                                <xs:sequence>
                                    <xs:element name="ChildNode">
                                        <xs:complexType>
                                            <xs:sequence>
    
                                            
                                                <xs:element name="${elementNameTransId}" type="xs:string" />
                                                <xs:element name="${elementNameTransStartUtc}" type="xs:string" />
                                                
                                                
                                            </xs:sequence>
                                        </xs:complexType>
                                    </xs:element>
                                </xs:sequence>
                            </xs:complexType>
                        </xs:element>
                    </xs:schema>]]></Schema>
                    
                <Xsl><![CDATA[]]></Xsl>
                <Storage>
                    <InternalStorage><![CDATA[variables]]></InternalStorage>
                </Storage>
                </XmlVariable>
        `;
    return xmlString;
}


//FOR SETTING THE FILTER TAG ELEMRNT 
function getFilterTag(action) {
    console.log(webapiListItemFromJson);
    let filterString = ``;
    const actioninfo = getActivityInfo(action);
    var actiontype = actioninfo.actiontype;
    if (actioninfo.isPartOfTransaction && actioninfo.isPartOfTransaction !== "" || actioninfo.isPartOfTransaction !== 'undefined') {
        var ispartOfTransactionPass = actioninfo.isPartOfTransaction;
    }
    if (actioninfo.apitype && actioninfo.apitype !== "" || actioninfo.apitype !== 'undefined') {
        var apitypePass = actioninfo.apitype;
    }

    if (actiontype === 'MESXMLCommand') {
        const commit_method_id = 'Method' + (processFile(xmlContent));
        const jsonstr = jsonTemp(actioninfo);
        //MESXMLCommand for get and getbykey activity
        if (actioninfo.apitype != '' && ((actioninfo.apitype.textContent).toLowerCase() === 'getbykey' || (actioninfo.apitype.textContent).toLowerCase() === 'getall')) {
            //MESXMLCommand with variables assign
            if (actioninfo.containsvariableassign > 0) {
                filterString = jsonstr.finalJsonString + `<OutputSaveIn>${actioninfo.outputVariable}</OutputSaveIn></WebAPIActivityProperties>`;
            }
            //MESXMLCommand without variables assign
            else {

                filterString = `<WebAPIActivityProperties><WebAPIListItemTitle>${webapiListItemFromJson}</WebAPIListItemTitle><IsOpenApi>true</IsOpenApi><HiddenfieldOperApiUri>${filePath}</HiddenfieldOperApiUri><OperationsGroup>V3_DirectAccess</OperationsGroup><OperationsGroupAPI>V3_DirectAccess_Get</OperationsGroupAPI><TextInputBaseUriAndOperation>Get</TextInputBaseUriAndOperation><BaseUri>${baseUrl}</BaseUri><RequestURI></RequestURI><HttpMethod>Get</HttpMethod><ShowHeader>False</ShowHeader><BaseParameters><TextInputSlNo>1</TextInputSlNo><Optional>NO</Optional><Name>spName</Name><HiddenAddtionalInformation>In:query</HiddenAddtionalInformation><DataType>string</DataType><ValueExpression isExpression="false">${actioninfo.spName}</ValueExpression></BaseParameters><BaseParameters><TextInputSlNo>2</TextInputSlNo><Optional>YES</Optional><Name>spParams</Name><HiddenAddtionalInformation>In:query</HiddenAddtionalInformation><DataType>string</DataType><ValueExpression isExpression="false"></ValueExpression></BaseParameters><LabelParameterExpression></LabelParameterExpression><RadioBodyParameters>Raw</RadioBodyParameters><BaseformBody><TextInputSlNoBody></TextInputSlNoBody><OptionalBody>YES</OptionalBody><NameBody></NameBody><HiddenAddtionalInformationBody></HiddenAddtionalInformationBody><DataTypeBody>string</DataTypeBody><ValueExpressionBody isExpression="false"></ValueExpressionBody></BaseformBody><LabelBodyParameterExpression></LabelBodyParameterExpression><ExpressionBodyRaw isExpression="false"></ExpressionBodyRaw><HiddenfieldObjectType></HiddenfieldObjectType><RequestURIFromApi>api/v3/DirectAccess?spName={1}</RequestURIFromApi><PostData isExpression="false"></PostData><ContentType></ContentType><Encoding>UTF-8</Encoding><FromBody>No</FromBody><UserListItemTitle></UserListItemTitle><OutputSaveInType>XmlVariable</OutputSaveInType><OutputSaveIn>${actioninfo.outputVariable}</OutputSaveIn></WebAPIActivityProperties>`;
            }
        }
        //MESXMLCommand for insert,update,delete
        else {
            //MESXMLCommand with variables assign
            if (actioninfo.containsvariableassign > 0) {
                filterString = `<WebAPIActivityProperties><WebAPIListItemTitle>${webapiListItemFromJson}</WebAPIListItemTitle><IsOpenApi>true</IsOpenApi><HiddenfieldOperApiUri>${filePath}</HiddenfieldOperApiUri><OperationsGroup>V3_DirectAccess</OperationsGroup><OperationsGroupAPI>V3_DirectAccess_Post</OperationsGroupAPI><TextInputBaseUriAndOperation>Post</TextInputBaseUriAndOperation><BaseUri>${baseUrl}</BaseUri><RequestURI></RequestURI><HttpMethod>Post</HttpMethod><ShowHeader>False</ShowHeader><BaseParameters><TextInputSlNo>1</TextInputSlNo><Optional>NO</Optional><Name>spName</Name><HiddenAddtionalInformation>In:query</HiddenAddtionalInformation><DataType>string</DataType><ValueExpression isExpression="false">${actioninfo.spName}</ValueExpression></BaseParameters><LabelParameterExpression></LabelParameterExpression><RadioBodyParameters>Raw</RadioBodyParameters><BaseformBody><TextInputSlNoBody>1</TextInputSlNoBody><OptionalBody>YES</OptionalBody><NameBody>DataType</NameBody><HiddenAddtionalInformationBody>In:body</HiddenAddtionalInformationBody><DataTypeBody>object</DataTypeBody><ValueExpressionBody isExpression="false"></ValueExpressionBody></BaseformBody><LabelBodyParameterExpression></LabelBodyParameterExpression><ExpressionBodyRaw isExpression="true">${jsonstr.finalJsonString}<OutputSaveIn>${actioninfo.outputVariable}</OutputSaveIn></WebAPIActivityProperties>`;
            }
            //MESXMLCommand without variables assign
            else {
                filterString = `<WebAPIActivityProperties><WebAPIListItemTitle>${webapiListItemFromJson}</WebAPIListItemTitle><IsOpenApi>true</IsOpenApi><HiddenfieldOperApiUri>${filePath}</HiddenfieldOperApiUri><OperationsGroup>V3_DirectAccess</OperationsGroup><OperationsGroupAPI>V3_DirectAccess_Post</OperationsGroupAPI><TextInputBaseUriAndOperation>Post</TextInputBaseUriAndOperation><BaseUri>${baseUrl}</BaseUri><RequestURI></RequestURI><HttpMethod>Post</HttpMethod><ShowHeader>False</ShowHeader><BaseParameters><TextInputSlNo>1</TextInputSlNo><Optional>NO</Optional><Name>spName</Name><HiddenAddtionalInformation>In:query</HiddenAddtionalInformation><DataType>string</DataType><ValueExpression isExpression="false">${actioninfo.spName}</ValueExpression></BaseParameters><LabelParameterExpression></LabelParameterExpression><RadioBodyParameters>Parameters</RadioBodyParameters><BaseformBody><TextInputSlNoBody>1</TextInputSlNoBody><OptionalBody>YES</OptionalBody><NameBody>DataType</NameBody><HiddenAddtionalInformationBody>In:body</HiddenAddtionalInformationBody><DataTypeBody>object</DataTypeBody><ValueExpressionBody isExpression="false"></ValueExpressionBody></BaseformBody><LabelBodyParameterExpression></LabelBodyParameterExpression><ExpressionBodyRaw isExpression="false"></ExpressionBodyRaw><HiddenfieldObjectType></HiddenfieldObjectType><RequestURIFromApi>api/v3/DirectAccess?spName={1}</RequestURIFromApi><PostData isExpression="false"></PostData><ContentType>application/json</ContentType><Encoding>UTF-8</Encoding><FromBody>No</FromBody><UserListItemTitle></UserListItemTitle><OutputSaveInType>XmlVariable</OutputSaveInType><OutputSaveIn>${actioninfo.outputVariable}</OutputSaveIn></WebAPIActivityProperties>`;
            }
        }
    }
    else if (actiontype === 'CommitMESTransaction') {
        const commit_method_id = 'Method' + (processFile(xmlContent));
        const jsonstr = jsonTemp(actioninfo);
        filterString = `<WebAPIActivityProperties><WebAPIListItemTitle>${webapiListItemFromJson}</WebAPIListItemTitle><IsOpenApi>true</IsOpenApi><HiddenfieldOperApiUri>${filePath}</HiddenfieldOperApiUri><OperationsGroup>V3_Transaction</OperationsGroup><OperationsGroupAPI>V3_Transaction_Put</OperationsGroupAPI><TextInputBaseUriAndOperation>Put</TextInputBaseUriAndOperation><BaseUri>${baseUrl}</BaseUri><RequestURI></RequestURI><HttpMethod>Put</HttpMethod><ShowHeader>False</ShowHeader><BaseParameters><TextInputSlNo>1</TextInputSlNo><Optional>NO</Optional><Name>action</Name><HiddenAddtionalInformation>In:query</HiddenAddtionalInformation><DataType>string</DataType><ValueExpression isExpression="false">commit</ValueExpression></BaseParameters><LabelParameterExpression></LabelParameterExpression><RadioBodyParameters>Raw</RadioBodyParameters><BaseformBody><TextInputSlNoBody></TextInputSlNoBody><OptionalBody>YES</OptionalBody><NameBody></NameBody><HiddenAddtionalInformationBody></HiddenAddtionalInformationBody><DataTypeBody>string</DataTypeBody><ValueExpressionBody isExpression="false"></ValueExpressionBody></BaseformBody><LabelBodyParameterExpression></LabelBodyParameterExpression><ExpressionBodyRaw isExpression="false"></ExpressionBodyRaw><HiddenfieldObjectType></HiddenfieldObjectType><Headers><Optional>NO</Optional><Key>trans_id</Key><Value isExpression="true">${jsonstr.finalJsonString}</Value></Headers><RequestURIFromApi>api/v3/transaction?action={1}</RequestURIFromApi><PostData isExpression="false"></PostData><ContentType>application/json</ContentType><Encoding>UTF-8</Encoding><FromBody>No</FromBody><UserListItemTitle></UserListItemTitle><OutputSaveInType></OutputSaveInType><OutputSaveIn></OutputSaveIn></WebAPIActivityProperties>`;
    }
    else if (actiontype === 'StartMESTransaction') {

        filterString = `<WebAPIActivityProperties><WebAPIListItemTitle>${webapiListItemFromJson}</WebAPIListItemTitle><IsOpenApi>true</IsOpenApi><HiddenfieldOperApiUri>${filePath}</HiddenfieldOperApiUri><OperationsGroup>V3_Transaction</OperationsGroup><OperationsGroupAPI>V3_Transaction_Post</OperationsGroupAPI><TextInputBaseUriAndOperation>Post</TextInputBaseUriAndOperation><BaseUri>${baseUrl}</BaseUri><RequestURI></RequestURI><HttpMethod>Post</HttpMethod><ShowHeader>False</ShowHeader><LabelParameterExpression></LabelParameterExpression><RadioBodyParameters>Raw</RadioBodyParameters><LabelBodyParameterExpression></LabelBodyParameterExpression><ExpressionBodyRaw isExpression="false"></ExpressionBodyRaw><HiddenfieldObjectType>Mes.WebApi.Models.V3.MesTransaction</HiddenfieldObjectType><RequestURIFromApi>api/v3/transaction</RequestURIFromApi><PostData isExpression="false"></PostData><ContentType>application/json</ContentType><Encoding>UTF-8</Encoding><FromBody>No</FromBody><UserListItemTitle></UserListItemTitle><OutputSaveInType>XmlVariable</OutputSaveInType><OutputSaveIn>${transidgen}</OutputSaveIn></WebAPIActivityProperties>`;
    }
    else if (actiontype === 'RollbackMESTransaction') {
        const rollback_method_id = 'Method' + (processFile(xmlContent));
        filterString = String.raw`<WebAPIActivityProperties><WebAPIListItemTitle>${webapiListItemFromJson}</WebAPIListItemTitle><IsOpenApi>true</IsOpenApi><HiddenfieldOperApiUri>${filePath}</HiddenfieldOperApiUri><OperationsGroup>V3_Transaction</OperationsGroup><OperationsGroupAPI>V3_Transaction_Put</OperationsGroupAPI><TextInputBaseUriAndOperation>Put</TextInputBaseUriAndOperation><BaseUri>${baseUrl}</BaseUri><RequestURI></RequestURI><HttpMethod>Put</HttpMethod><ShowHeader>False</ShowHeader><BaseParameters><TextInputSlNo>1</TextInputSlNo><Optional>NO</Optional><Name>action</Name><HiddenAddtionalInformation>In:query</HiddenAddtionalInformation><DataType>string</DataType><ValueExpression isExpression="false">rollback</ValueExpression></BaseParameters><LabelParameterExpression></LabelParameterExpression><RadioBodyParameters>Raw</RadioBodyParameters><BaseformBody><TextInputSlNoBody></TextInputSlNoBody><OptionalBody>YES</OptionalBody><NameBody></NameBody><HiddenAddtionalInformationBody></HiddenAddtionalInformationBody><DataTypeBody>string</DataTypeBody><ValueExpressionBody isExpression="false"></ValueExpressionBody></BaseformBody><LabelBodyParameterExpression></LabelBodyParameterExpression><ExpressionBodyRaw isExpression="false"></ExpressionBodyRaw><HiddenfieldObjectType></HiddenfieldObjectType><Headers><Optional>NO</Optional><Key>trans_id</Key><Value isExpression="true">{&quot;ApplicationName&quot;:&quot;${applicationName}&quot;,&quot;WorkflowName&quot;:&quot;${workflowName}&quot;,&quot;FileName&quot;:&quot;1&quot;,&quot;ActionName&quot;:&quot;Rollback&quot;,&quot;propertyName&quot;:&quot;${propertyName}&quot;,&quot;ExpressionString&quot;:&quot;{\&quot;DisplayExpressionString\&quot;:\&quot;return XmlVariables.${transidgen}.root.ChildNode.trans_id;\&quot;,\n\&quot;ActualExprtessionString\&quot;:\&quot;return ${rollback_method_id}(_context,\\\&quot;!!!XmlVar!!!.${transidgen}.root.ChildNode.trans_id\\\&quot;);\&quot;,\n\&quot;MethodParameterList\&quot;:\&quot;Workflow.NET.Engine.Context _context\&quot;,\n\&quot;HtmlVerexpString\&quot;:\&quot;return&amp;nbsp;XmlVariables.${transidgen}.root.ChildNode.trans_id;\&quot;,\n\&quot;ReferenceList\&quot;:\&quot;${referenceListFromJson}[INSTALLDIR]Bin$$Workflow.NET.NET2.dll\&quot;,\n\&quot;ReferencedFunctionList\&quot;:\&quot;private object  ${rollback_method_id}(Workflow.NET.Engine.Context _context,string variableName){\\nstring nodeText = variableName.Substring(13);\\nstring varname = nodeText.Substring(0, nodeText.IndexOf(&apos;.&apos;));\\nstring xpath = nodeText.Substring(nodeText.IndexOf(&apos;.&apos;) + 1);\\nxpath = Workflow.NET.CommonFunctions.EncodeXpath(xpath);xpath = xpath.Replace(&apos;.&apos;, &apos;/&apos;);object[] values = _context.XmlVariables[varname].GetNodeValues(\\\&quot;//\\\&quot; + xpath);\\nif (values == null) values = new object[] { \\\&quot;\\\&quot; };\\nreturn values[0];\\n}\\n\&quot;,\n\&quot;NodeInfo\&quot;:\&quot;XmlVariables.${transidgen}.root.ChildNode.trans_id#${rollback_method_id}(_context,\\\&quot;!!!XmlVar!!!.${transidgen}.root.ChildNode.trans_id\\\&quot;)\&quot;,\n\&quot;ReturnType\&quot;:\&quot;object\&quot;}&quot;}</Value></Headers><RequestURIFromApi>api/v3/transaction?action={1}</RequestURIFromApi><PostData isExpression="false"></PostData><ContentType>application/json</ContentType><Encoding>UTF-8</Encoding><FromBody>No</FromBody><UserListItemTitle></UserListItemTitle><OutputSaveInType></OutputSaveInType><OutputSaveIn></OutputSaveIn></WebAPIActivityProperties>`;
    }
    if (ispartOfTransactionPass && apitypePass) {

        return { filterString, ispartOfTransactionPass, apitypePass };
    }
    else {

        return { filterString };
    }

}

//FOR GETTING ACTIVITY INFORMATION
function getActivityInfo(action_name) {
    let containsvariableassign;
    var isPartOfTransaction;
    const actions = xmlDoc.getElementsByTagName('action');
    for (let i = 0; i < actions.length; i++) {
        const actionElement = actions[i];
        const actiontype = actionElement.getAttribute('type');
        if (actionElement.getAttribute('name') === action_name) {
            const apiSpListElement = actionElement.getElementsByTagName('API_SP_list')[0];
            const outputXmlVariable = actionElement.getElementsByTagName('OutputXmlValue')[0];
            const apitype = actionElement.getElementsByTagName('MessageType')[0];
            const transactionParticipantElement = actionElement.querySelector('property[name="Transaction Participant"]');
            const properties = actionElement.getElementsByTagName('property');
            for (let j = 0; j < properties.length; j++) {
                const property = properties[j];
                const propertyName = property.getAttribute('name');
                const propertyValue = property.textContent.trim();
                if (propertyName === "Initialize Variable(s)") {
                    // Get contentupdationfields element if it exists
                    const contentUpdationFields = property.getElementsByTagName('contentupdationfields');
                    if (contentUpdationFields.length > 0) {
                        // Get all contentupdationfield elements
                        const contentUpdationFieldElements = contentUpdationFields[0].getElementsByTagName('contentupdationfield');
                        containsvariableassign = contentUpdationFieldElements.length;
                    }
                }
            }

            if (transactionParticipantElement) {
                isPartOfTransaction = transactionParticipantElement.textContent.trim();
            }


            // Check if the 'API_SP_list' element exists
            if (apiSpListElement) {
                spName = apiSpListElement.textContent.trim();
                let outputVariable = null;
                // If 'OutputXmlValue' exists, get its value
                if (outputXmlVariable) {
                    outputVariable = outputXmlVariable.textContent.trim();
                    generateStartXMLVariables(action_name, spName, outputVariable);
                }

                // Log and return both values
                return { spName, outputVariable, parameters, action_name, actiontype, apitype, isPartOfTransaction, containsvariableassign };
            }
            else {
                return { action_name, actiontype };
            }
        }
    }
}



//FOR GETTING THE JSON VALUE FRO FILTER BY ACTION DATA
function jsonTemp(activitydata) {
    var actiontype = activitydata.actiontype;

    if (actiontype != 'CommitMESTransaction' && actiontype != 'StartMESTransaction' && actiontype != 'RollbackMESTransaction') {
        var outputVariable = activitydata.outputVariable;
        var parameters = activitydata.parameters;
        var action_name = activitydata.action_name;
        var actiontype = activitydata.actiontype;
        var spType = ((activitydata.spName.toLowerCase()).match(/_(.*?)_/)?.[1] || "").toLowerCase();
        addExpressionString(action_name, spType);
        if (activitydata.isPartOfTransaction && activitydata.isPartOfTransaction === "Yes") {
            var trans_method_Id = 'Method' + (processFile(xmlContent));
            var ispartOfTransactionString = String.raw`="true">{&quot;ApplicationName&quot;:&quot;${applicationName}&quot;,&quot;WorkflowName&quot;:&quot;${workflowName}&quot;,&quot;FileName&quot;:&quot;1&quot;,&quot;ActionName&quot;:&quot;MESXMLCommand1&quot;,&quot;propertyName&quot;:&quot;${propertyName}&quot;,&quot;ExpressionString&quot;:&quot;{\&quot;DisplayExpressionString\&quot;:\&quot;return XmlVariables.${transidgen}.root.ChildNode.trans_id;\&quot;,\n\&quot;ActualExprtessionString\&quot;:\&quot;return ${trans_method_Id}(_context,\\\&quot;!!!XmlVar!!!.${transidgen}.root.ChildNode.trans_id\\\&quot;);\&quot;,\n\&quot;MethodParameterList\&quot;:\&quot;Workflow.NET.Engine.Context _context\&quot;,\n\&quot;HtmlVerexpString\&quot;:\&quot;return&amp;nbsp;XmlVariables.${transidgen}.root.ChildNode.trans_id;\&quot;,\n\&quot;ReferenceList\&quot;:\&quot;${referenceListFromJson}[INSTALLDIR]Bin$$Workflow.NET.NET2.dll\&quot;,\n\&quot;ReferencedFunctionList\&quot;:\&quot;private object  ${trans_method_Id}(Workflow.NET.Engine.Context _context,string variableName){\\nstring nodeText = variableName.Substring(13);\\nstring varname = nodeText.Substring(0, nodeText.IndexOf(&apos;.&apos;));\\nstring xpath = nodeText.Substring(nodeText.IndexOf(&apos;.&apos;) + 1);\\nxpath = Workflow.NET.CommonFunctions.EncodeXpath(xpath);xpath = xpath.Replace(&apos;.&apos;, &apos;/&apos;);object[] values = _context.XmlVariables[varname].GetNodeValues(\\\&quot;//\\\&quot; + xpath);\\nif (values == null) values = new object[] { \\\&quot;\\\&quot; };\\nreturn values[0];\\n}\\n\&quot;,\n\&quot;NodeInfo\&quot;:\&quot;XmlVariables.${transidgen}.root.ChildNode.trans_id#${trans_method_Id}(_context,\\\&quot;!!!XmlVar!!!.${transidgen}.root.ChildNode.trans_id\\\&quot;)\&quot;,\n\&quot;ReturnType\&quot;:\&quot;object\&quot;}&quot;}`;
        }
        else {
            var ispartOfTransactionString = String.raw`="false">`;
        }
    }

    //Json Template
    var jsonTemp = {
        "ApplicationName": applicationName,
        "WorkflowName": workflowName,
        "FileName": "1",
        "ActionName": "",
        "propertyName": propertyName,
        "ExpressionString": {
            "__DisplayExpressionString__": "",
            "___ActualExprtessionString__": "",
            "___MethodParameterList__": "Workflow.NET.Engine.Context _context",
            "___HtmlVerexpString__": "",
            "___ReferenceList__": "[INSTALLDIR]Bin$$Workflow.NET.NET2.dll",
            "___ReferencedFunctionList__": "",
            "___NodeInfo__": "",
            "___ReturnType__": "object"
        }
    }

    var postData = String.raw`</ExpressionBodyRaw><HiddenfieldObjectType></HiddenfieldObjectType><Headers><Optional>YES</Optional><Key>trans_id</Key><Value isExpression${ispartOfTransactionString}</Value></Headers><RequestURIFromApi>api/v3/DirectAccess?spName={1}</RequestURIFromApi><PostData isExpression="true">`;
    var postDataend = String.raw`</PostData><ContentType>application/json</ContentType><Encoding>UTF-8</Encoding><FromBody>No</FromBody><UserListItemTitle></UserListItemTitle><OutputSaveInType>XmlVariable</OutputSaveInType>`;

    if (actiontype === 'CommitMESTransaction') {
        var methodId = (processFile(xmlContent));
        var displayExpressionString = 'XmlVariables.' + transidgen + '.root.ChildNode.trans_id;';
        var actualExpressionString = 'Method' + methodId + '(_context,\\"!!!XmlVar!!!.' + transidgen + '.root.ChildNode.trans_id\\");';
        var htmlVerexpString = 'XmlVariables.' + transidgen + '.root.ChildNode.trans_id;';
        var referencedFunctionList = "private object  Method" + methodId + "(Workflow.NET.Engine.Context _context,string variableName){\\nstring nodeText = variableName.Substring(13);\\nstring varname = nodeText.Substring(0, nodeText.IndexOf('.'));\\nstring xpath = nodeText.Substring(nodeText.IndexOf('.') + 1);\\nxpath = Workflow.NET.CommonFunctions.EncodeXpath(xpath);xpath = xpath.Replace('.', '/');object[] values = _context.XmlVariables[varname].GetNodeValues(\\\"//\\\" + xpath);\\nif (values == null) values = new object[] { \\\"\\\" };\\nreturn values[0];\\n}\\n";
        var nodeInfo = 'XmlVariables.' + transidgen + '.root.ChildNode.trans_id#Method' + methodId + '(_context,\\"!!!XmlVar!!!.' + transidgen + '.root.ChildNode.trans_id\\")';

        jsonTemp.ActionName = activitydata.action_name;
        jsonTemp.ExpressionString.__DisplayExpressionString__ = displayExpressionString;
        jsonTemp.ExpressionString.___ActualExprtessionString__ = actualExpressionString;
        jsonTemp.ExpressionString.___HtmlVerexpString__ = htmlVerexpString;
        jsonTemp.ExpressionString.___ReferencedFunctionList__ = referencedFunctionList;
        jsonTemp.ExpressionString.___NodeInfo__ = nodeInfo;


        let finalJsonString = JSON.stringify(jsonTemp)
            .replace(/{"__/g, '&quot;{\\&quot;')
            .replace(/__":"/g, '\\&quot;:\\&quot;')
            .replace(/","___/g, '\\&quot;,\\n\\&quot;')
            .replace(/"}/g, '\\&quot;}&quot;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
        return { finalJsonString };
    }

    else if (actiontype === 'MESXMLCommand' && spType === 'i') {
        var methodId = (processFile(xmlContent));
        var displayExpressionString = finalDisplayExpression;
        var actualExpressionString = finalActualExpressionString;
        var htmlVerexpString = finalHtmlVerexpString;
        var referencedFunctionList = finalreferencedFunctionList;
        var nodeInfo = finalNodeInfo;


        jsonTemp.ActionName = activitydata.action_name;
        jsonTemp.ExpressionString.__DisplayExpressionString__ = displayExpressionString;
        jsonTemp.ExpressionString.___ActualExprtessionString__ = actualExpressionString;
        jsonTemp.ExpressionString.___HtmlVerexpString__ = htmlVerexpString;
        jsonTemp.ExpressionString.___ReferencedFunctionList__ = referencedFunctionList;
        jsonTemp.ExpressionString.___NodeInfo__ = nodeInfo;


        jsonString = JSON.stringify(jsonTemp)
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;')
            .replace(/{&quot;__/g, '&quot;{\\&quot;')
            .replace(/__&quot;:/g, '\\&quot;:\\')
            .replace(/&quot;,&quot;___/g, '\\&quot;,\\n\\&quot;')
            .replace(/object&quot;}}/g, 'object\\&quot;}&quot;}')
            .replace(/__4_4__/g, '\\\\\\')
            .replace(/2_22_222__/g, '\\\\\\')

        let finalJsonString = jsonString + postData + jsonString + postDataend;
        return { finalJsonString };
    }

    else if (actiontype === 'MESXMLCommand' && spType === 'u') {
        var methodId = (processFile(xmlContent));
        var displayExpressionString = finalDisplayExpression;
        var actualExpressionString = finalActualExpressionString;
        var htmlVerexpString = finalHtmlVerexpString;
        var referencedFunctionList = finalreferencedFunctionList;
        var nodeInfo = finalNodeInfo;

        jsonTemp.ActionName = activitydata.action_name;
        jsonTemp.ExpressionString.__DisplayExpressionString__ = displayExpressionString;
        jsonTemp.ExpressionString.___ActualExprtessionString__ = actualExpressionString;
        jsonTemp.ExpressionString.___HtmlVerexpString__ = htmlVerexpString;
        jsonTemp.ExpressionString.___ReferencedFunctionList__ = referencedFunctionList;
        jsonTemp.ExpressionString.___NodeInfo__ = nodeInfo;


        jsonString = JSON.stringify(jsonTemp)
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;')
            .replace(/{&quot;__/g, '&quot;{\\&quot;')
            .replace(/__&quot;:/g, '\\&quot;:\\')
            .replace(/&quot;,&quot;___/g, '\\&quot;,\\n\\&quot;')
            .replace(/object&quot;}}/g, 'object\\&quot;}&quot;}')
            .replace(/__4_4__/g, '\\\\\\')
            .replace(/2_22_222__/g, '\\\\\\')


        let finalJsonString = jsonString + postData + jsonString + postDataend;
        return { finalJsonString };
    }

    else if (actiontype === 'MESXMLCommand' && spType === 'd') {
        var methodId = (processFile(xmlContent));
        var displayExpressionString = finalDisplayExpression;
        var actualExpressionString = finalActualExpressionString;
        var htmlVerexpString = finalHtmlVerexpString;
        var referencedFunctionList = finalreferencedFunctionList;
        var nodeInfo = finalNodeInfo;

        jsonTemp.ActionName = activitydata.action_name;
        jsonTemp.ExpressionString.___MethodParameterList__ = "";
        jsonTemp.ExpressionString.__DisplayExpressionString__ = displayExpressionString;
        jsonTemp.ExpressionString.___ActualExprtessionString__ = actualExpressionString;
        jsonTemp.ExpressionString.___HtmlVerexpString__ = htmlVerexpString;
        jsonTemp.ExpressionString.___ReferencedFunctionList__ = referencedFunctionList;
        jsonTemp.ExpressionString.___NodeInfo__ = nodeInfo;


        jsonString = JSON.stringify(jsonTemp)
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;')
            .replace(/{&quot;__/g, '&quot;{\\&quot;')
            .replace(/__&quot;:/g, '\\&quot;:\\')
            .replace(/&quot;,&quot;___/g, '\\&quot;,\\n\\&quot;')
            .replace(/object&quot;}}/g, 'object\\&quot;}&quot;}')
            .replace(/__4_4__/g, '\\\\\\')
            .replace(/2_22_222__/g, '\\\\\\')

        let finalJsonString = jsonString + postData + jsonString + postDataend;
        return { finalJsonString };
    }
    else if (actiontype === 'MESXMLCommand' && spType === 's') {

        var selectPostData = String.raw`<WebAPIActivityProperties><WebAPIListItemTitle>${webapiListItemFromJson}</WebAPIListItemTitle><IsOpenApi>true</IsOpenApi><HiddenfieldOperApiUri>${filePath}</HiddenfieldOperApiUri><OperationsGroup>V3_DirectAccess</OperationsGroup><OperationsGroupAPI>V3_DirectAccess_Get</OperationsGroupAPI><TextInputBaseUriAndOperation>Get</TextInputBaseUriAndOperation><BaseUri>${baseUrl}</BaseUri><RequestURI></RequestURI><HttpMethod>Get</HttpMethod><ShowHeader>False</ShowHeader><BaseParameters><TextInputSlNo>1</TextInputSlNo><Optional>NO</Optional><Name>spName</Name><HiddenAddtionalInformation>In:query</HiddenAddtionalInformation><DataType>string</DataType><ValueExpression isExpression="false">${activitydata.spName}</ValueExpression></BaseParameters><BaseParameters><TextInputSlNo>2</TextInputSlNo><Optional>YES</Optional><Name>spParams</Name><HiddenAddtionalInformation>In:query</HiddenAddtionalInformation><DataType>string</DataType><ValueExpression isExpression="true">`;
        var selectPostDataend = String.raw`</ValueExpression></BaseParameters><LabelParameterExpression></LabelParameterExpression><RadioBodyParameters>Raw</RadioBodyParameters><BaseformBody><TextInputSlNoBody></TextInputSlNoBody><OptionalBody>YES</OptionalBody><NameBody></NameBody><HiddenAddtionalInformationBody></HiddenAddtionalInformationBody><DataTypeBody>string</DataTypeBody><ValueExpressionBody isExpression="false"></ValueExpressionBody></BaseformBody><LabelBodyParameterExpression></LabelBodyParameterExpression><ExpressionBodyRaw isExpression="false"></ExpressionBodyRaw><HiddenfieldObjectType></HiddenfieldObjectType><Headers><Optional>YES</Optional><Key>trans_id</Key><Value isExpression="false"></Value></Headers><Headers><Optional>YES</Optional><Key>max_rows</Key><Value isExpression="false"></Value></Headers><RequestURIFromApi>api/v3/DirectAccess?spName={1}&amp;spParams={2}</RequestURIFromApi><PostData isExpression="false"></PostData><ContentType></ContentType><Encoding>UTF-8</Encoding><FromBody>No</FromBody><UserListItemTitle></UserListItemTitle><OutputSaveInType>XmlVariable</OutputSaveInType>`;
        var methodId = (processFile(xmlContent));
        var displayExpressionString = finalDisplayExpression;
        var actualExpressionString = finalActualExpressionString;
        var htmlVerexpString = finalDisplayExpression;
        var referencedFunctionList = finalreferencedFunctionList;
        var nodeInfo = finalNodeInfo;

        jsonTemp.ActionName = activitydata.action_name;
        jsonTemp.ExpressionString.__DisplayExpressionString__ = displayExpressionString;
        jsonTemp.ExpressionString.___ActualExprtessionString__ = actualExpressionString;
        jsonTemp.ExpressionString.___HtmlVerexpString__ = htmlVerexpString;
        jsonTemp.ExpressionString.___ReferencedFunctionList__ = referencedFunctionList;
        jsonTemp.ExpressionString.___NodeInfo__ = nodeInfo;


        jsonString = JSON.stringify(jsonTemp)
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;')
            .replace(/{&quot;__/g, '&quot;{\\&quot;')
            .replace(/__&quot;:/g, '\\&quot;:\\')
            .replace(/&quot;,&quot;___/g, '\\&quot;,\\n\\&quot;')
            .replace(/object&quot;}}/g, 'object\\&quot;}&quot;}')
            .replace(/__4_4__/g, '\\\\\\')
            .replace(/2_22_222__/g, '\\\\\\')
            .replace(/_5__55___/g, ';')
            .replace(/_6__66___/g, '\\')
            .replace(/_7__77___/g, '&apos;')
            .replace(/_8__88___/g, '"')
            .replace(/_9__99___/g, '&lt;')
            .replace(/_10__1010___/g, '&gt;')
            .replace(/_11__1111___/g, '&amp;')


        let finalJsonString = selectPostData + jsonString + selectPostDataend;
        return { finalJsonString };
    }
    else if (actiontype === 'MESXMLCommand' && spType === 'sa') {
        var selectPostData = String.raw`<WebAPIActivityProperties><WebAPIListItemTitle>${webapiListItemFromJson}</WebAPIListItemTitle><IsOpenApi>true</IsOpenApi><HiddenfieldOperApiUri>${filePath}</HiddenfieldOperApiUri><OperationsGroup>V3_DirectAccess</OperationsGroup><OperationsGroupAPI>V3_DirectAccess_Get</OperationsGroupAPI><TextInputBaseUriAndOperation>Get</TextInputBaseUriAndOperation><BaseUri>${baseUrl}</BaseUri><RequestURI></RequestURI><HttpMethod>Get</HttpMethod><ShowHeader>False</ShowHeader><BaseParameters><TextInputSlNo>1</TextInputSlNo><Optional>NO</Optional><Name>spName</Name><HiddenAddtionalInformation>In:query</HiddenAddtionalInformation><DataType>string</DataType><ValueExpression isExpression="false">${activitydata.spName}</ValueExpression></BaseParameters><BaseParameters><TextInputSlNo>2</TextInputSlNo><Optional>YES</Optional><Name>spParams</Name><HiddenAddtionalInformation>In:query</HiddenAddtionalInformation><DataType>string</DataType><ValueExpression isExpression="true">`;
        var selectPostDataend = String.raw`</ValueExpression></BaseParameters><LabelParameterExpression></LabelParameterExpression><RadioBodyParameters>Raw</RadioBodyParameters><BaseformBody><TextInputSlNoBody></TextInputSlNoBody><OptionalBody>YES</OptionalBody><NameBody></NameBody><HiddenAddtionalInformationBody></HiddenAddtionalInformationBody><DataTypeBody>string</DataTypeBody><ValueExpressionBody isExpression="false"></ValueExpressionBody></BaseformBody><LabelBodyParameterExpression></LabelBodyParameterExpression><ExpressionBodyRaw isExpression="false"></ExpressionBodyRaw><HiddenfieldObjectType></HiddenfieldObjectType><Headers><Optional>YES</Optional><Key>trans_id</Key><Value isExpression="false"></Value></Headers><Headers><Optional>YES</Optional><Key>max_rows</Key><Value isExpression="false"></Value></Headers><RequestURIFromApi>api/v3/DirectAccess?spName={1}&amp;spParams={2}</RequestURIFromApi><PostData isExpression="false"></PostData><ContentType></ContentType><Encoding>UTF-8</Encoding><FromBody>No</FromBody><UserListItemTitle></UserListItemTitle><OutputSaveInType>XmlVariable</OutputSaveInType>`;
        var methodId = (processFile(xmlContent));
        var displayExpressionString = finalDisplayExpression;
        var actualExpressionString = finalActualExpressionString;
        var htmlVerexpString = finalDisplayExpression;
        var referencedFunctionList = finalreferencedFunctionList;
        var nodeInfo = finalNodeInfo;



        jsonTemp.ActionName = activitydata.action_name;
        jsonTemp.ExpressionString.__DisplayExpressionString__ = displayExpressionString;
        jsonTemp.ExpressionString.___ActualExprtessionString__ = actualExpressionString;
        jsonTemp.ExpressionString.___HtmlVerexpString__ = htmlVerexpString;
        jsonTemp.ExpressionString.___ReferencedFunctionList__ = referencedFunctionList;
        jsonTemp.ExpressionString.___NodeInfo__ = nodeInfo;


        jsonString = JSON.stringify(jsonTemp)
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;')
            .replace(/{&quot;__/g, '&quot;{\\&quot;')
            .replace(/__&quot;:/g, '\\&quot;:\\')
            .replace(/&quot;,&quot;___/g, '\\&quot;,\\n\\&quot;')
            .replace(/object&quot;}}/g, 'object\\&quot;}&quot;}')
            .replace(/__4_4__/g, '\\\\\\')
            .replace(/2_22_222__/g, '\\\\\\')

        let finalJsonString = selectPostData + jsonString + selectPostDataend;
        return { finalJsonString };
    }
}


// FUNCTION ADD  EXPRESSIONSTRING

function addExpressionString(actionName, spType) {
    let param = [];
    let parameterValues = [];
    let paramtype = [];
    let objType = [];
    const actions = xmlDoc.getElementsByTagName('action');
    for (let i = 0; i < actions.length; i++) {
        const actionElement = actions[i];
        const actiontype = actionElement.getAttribute('type');
        if (actionElement.getAttribute('name') === actionName) {
            const outputXmlVariable = actionElement.getElementsByTagName('OutputXmlValue')[0];
            const properties = actionElement.getElementsByTagName('property');
            for (let j = 0; j < properties.length; j++) {
                const property = properties[j];
                const propertyName = property.getAttribute('name');
                const propertyValue = property.textContent.trim();
                if (propertyName === "Initialize Variable(s)") {
                    // Get contentupdationfields element if it exists
                    const contentUpdationFields = property.getElementsByTagName('contentupdationfields');
                    if (contentUpdationFields.length > 0) {
                        // Get all contentupdationfield elements
                        const contentUpdationFieldElements = contentUpdationFields[0].getElementsByTagName('contentupdationfield');
                        // Loop through contentupdationfield elements and log their names
                        for (let k = 0; k < contentUpdationFieldElements.length; k++) {
                            const contentUpdationField = contentUpdationFieldElements[k];
                            const fieldName = contentUpdationField.getAttribute('name');
                            const parametertype = contentUpdationField.getAttribute('mode');
                            const operatorType = contentUpdationField.getAttribute('operator');
                            param.push(fieldName.split('.').pop());

                            parameterValues.push(((contentUpdationField.innerHTML).match(/<!\[CDATA\[(.*?)\]\]>/s)?.[1] || '').replace(/MESUserName/g, "UserName"));

                            paramtype.push(parametertype.split('.').pop());

                            objType.push(operatorType);

                        }
                        let finalNodeInfoString = '';
                        let setDisplayExpression = '';
                        let setfinalActualExpression = '';
                        var setfinalNodeInfo = '';
                        var setreferenceFunctionList = '';
                        var expressionVariables = '';
                        let expressionActualString = '';
                        var referencedFunctionListCount = 0;

                        for (let i = 0; i < param.length; i++) {
                            var objTreeXmlJson = parameterValues[i];
                            var setfinalDisplayExpression = '';
                            var setfinalActualExpressionString = '';
                            var setfinalreferenceFunctionList = '';
                            var setExpressionVariables = '';
                            var setExpressionActualString = '';
                            if (paramtype[i] === 'Expression') {

                                const jsonContent = JSON.parse(parameterValues[i]);
                                const buildExpVariable = (jsonContent.DisplayExpressionString).replace(/^return\s/, '').replace(/;\s*$/, '').replace(/"/g, '');
                                const valuetype = ((buildExpVariable.includes('System') && (buildExpVariable.split('.').length - 1 === 2)) ? '1' : '0');
                                //For Default return using Expression
                                if (jsonContent.DisplayExpressionString === jsonContent.ActualExprtessionString && valuetype === 0) {
                                    setDisplayExpression += String.raw`\\\"${param[i]}\\\": \\\"${buildExpVariable}\\\",`;
                                    setfinalActualExpression += String.raw`\\\"${param[i]}\\\": \\\"${buildExpVariable}\\\",`;
                                }
                                else {
                                    var ExpressionCode = parseCSharpCode(JSON.stringify(jsonContent.DisplayExpressionString));
                                    setExpressionVariables += ExpressionCode.variablesStr;
                                    setDisplayExpression += String.raw`\\\"${param[i]}\\\": \\\"\"+${ExpressionCode.valuesStr}+\"\\\",`;
                                    setfinalActualExpression += String.raw`\\\"${param[i]}\\\": \\\"\"+${(parseCSharpCode(JSON.stringify(jsonContent.ActualExprtessionString))).valuesStr}+\"\\\",`;
                                    setExpressionActualString += (parseCSharpCode(JSON.stringify(jsonContent.ActualExprtessionString))).variablesStr;
                                    //Code to setreferenceFunctionList for Expression Xmlvariable 
                                    setreferenceFunctionList += String.raw`#${JSON.stringify(jsonContent.ReferencedFunctionList).replace('"', '').replace(/"(?!.*")/, '')}`;
                                    referencedFunctionListCount++;
                                    //Code to NodeInfo for Expression Xmlvariable
                                    finalNodeInfoString += String.raw`$${jsonContent.NodeInfo.replace(/"/g, '2_22_222__&quot;')}`;
                                }
                            }

                            if (paramtype[i] === 'ObjTree') {
                                //For ObjTree variable return 
                                if ((parameterValues[i].includes('.') ? parameterValues[i].split('.')[0] : parameterValues[i]) === "Variable") {
                                    let dotCount = (parameterValues[i].match(/\./g) || []).length;
                                    if (dotCount == 1 && (!parameterValues[i].includes('Variable.SubmittedBy') || !parameterValues[i].includes('Variable.userWithDomain'))) {
                                        setDisplayExpression += String.raw`\\\"${param[i]}\\\": \\\"\" + ${parameterValues[i]} + \"\\\",`;
                                        setfinalActualExpression += String.raw`\\\"${param[i]}\\\": \\\"\" + _context.Variables[\"${parameterValues[i].replace(/Variable./g, '')}\"].Value + \"\\\",`;
                                        //Code to setreferenceFunctionList for objectTree Variable
                                        setreferenceFunctionList += String.raw`#private object  Method${processFile(xmlContent)}(Workflow.NET.Engine.Context _context,string variableName){\nstring nodeText = variableName.Substring(13);\nstring varname = nodeText.Substring(0, nodeText.IndexOf(&apos;.&apos;));\nstring xpath = nodeText.Substring(nodeText.IndexOf(&apos;.&apos;) + 1);\nxpath = Workflow.NET.CommonFunctions.EncodeXpath(xpath);xpath = xpath.Replace(&apos;.&apos;, &apos;/&apos;);object[] values = _context.XmlVariables[varname].GetNodeValues(__4_4__&quot;//__4_4__&quot; + xpath);\nif (values == null) values = new object[] { __4_4__&quot;__4_4__&quot; };\nreturn values[0];\n}\n`;
                                        referencedFunctionListCount++;
                                        //Code to NodeInfo for objectTree variable
                                        finalNodeInfoString += String.raw`$Variable.${parameterValues[i].split('.').pop()}#_context.Variables[\"${param[i]}\"].Value`;
                                    } else if (dotCount == 2 && (parameterValues[i].includes('Variable.SubmittedBy') || parameterValues[i].includes('Variable.userWithDomain'))) {
                                        let parts = parameterValues[i].split('.');
                                        const methodvalue = processFile(xmlContent);
                                        setDisplayExpression += String.raw`\\\"${param[i]}\\\": \\\"\" + ${parameterValues[i].replace(/Variable/g, "Variables")} + \"\\\",`;
                                        setfinalActualExpression += String.raw`\\\"${param[i]}\\\": \\\"\" + Method${methodvalue}(_context)+ \"\\\",`;
                                        //Code to setreferenceFunctionList for objectTree Variable
                                        setreferenceFunctionList += String.raw`#private object  Method${methodvalue}(Workflow.NET.Engine.Context _context){\nreturn ((Resource)_context.Variables[2_22_222__&quot;${parts[1]}2_22_222__&quot;].Value).Properties[2_22_222__&quot;${parts[2]}2_22_222__&quot;].Value;\n}`;
                                        referencedFunctionListCount++;
                                        //Code to NodeInfo for objectTree variable
                                        finalNodeInfoString += String.raw`$${parameterValues[i].replace(/Variable/g, "Variables")}#Method${methodvalue}(_context)`;
                                    }


                                }
                                //For ObjTree xmlvariable return
                                else if ((parameterValues[i].includes('.') ? parameterValues[i].split('.')[0] : parameterValues[i]) === "XmlVariables") {
                                    var objectTreeXmlMethoID = "Method" + processFile(xmlContent);
                                    setDisplayExpression += String.raw`\\\"${param[i]}\\\": \\\"\" + ${parameterValues[i]} + \"\\\",`;
                                    setfinalActualExpression += String.raw`\\\"${param[i]}\\\": \\\"\" + ${objectTreeXmlMethoID}(_context,\"${parameterValues[i].replace(/XmlVariables./g, '!!!XmlVar!!!.')}\" )+ \"\\\",`;
                                    //Code to setreferenceFunctionList for objectTree Xmlvariable
                                    setreferenceFunctionList += String.raw`#private object  ${objectTreeXmlMethoID}(Workflow.NET.Engine.Context _context,string variableName){\nstring nodeText = variableName.Substring(13);\nstring varname = nodeText.Substring(0, nodeText.IndexOf(&apos;.&apos;));\nstring xpath = nodeText.Substring(nodeText.IndexOf(&apos;.&apos;) + 1);\nxpath = Workflow.NET.CommonFunctions.EncodeXpath(xpath);xpath = xpath.Replace(&apos;.&apos;, &apos;/&apos;);object[] values = _context.XmlVariables[varname].GetNodeValues(__4_4__&quot;//__4_4__&quot; + xpath);\nif (values == null) values = new object[] { __4_4__&quot;__4_4__&quot; };\nreturn values[0];\n}\n`;
                                    referencedFunctionListCount++;
                                    //Code to NodeInfo for objectTree Xmlvariable
                                    finalNodeInfoString += String.raw`$${parameterValues[i]}#${objectTreeXmlMethoID}(_context,__4_4__&quot;${parameterValues[i].replace(/XmlVariables./g, '!!!XmlVar!!!.')}__4_4__&quot;)`;
                                }

                            }

                            if (paramtype[i] === 'Default') {
                                setDisplayExpression += String.raw`\\\"${param[i]}\\\":\\\"${parameterValues[i].replace(/;/g, '_5__55___').replace(/\\/g, '_6__66___').replace(/'/g, '_7__77___').replace(/"/g, '_8__88___').replace(/</g, '_9__99___').replace(/>/g, '_10__1010___').replace(/&/g, '_11__1111___')}\\\",`;
                                setfinalActualExpression += String.raw`\\\"${param[i]}\\\":\\\"${parameterValues[i].replace(/;/g, '_5__55___').replace(/\\/g, '_6__66___').replace(/'/g, '_7__77___').replace(/"/g, '_8__88___').replace(/</g, '_9__99___').replace(/>/g, '_10__1010___').replace(/&/g, '_11__1111___')}\\\",`;
                            }


                            setfinalDisplayExpression += setDisplayExpression;
                            setfinalActualExpressionString += setfinalActualExpression;
                            setfinalreferenceFunctionList += setreferenceFunctionList;
                            expressionVariables += setExpressionVariables;
                            expressionActualString += setExpressionActualString;

                        }

                        if (contentUpdationFieldElements.length > 0) {

                            finalDisplayExpression = expressionVariables + startString + ((setfinalDisplayExpression + '__').replace(/,__/g, '').replace(/&nbsp/g, '').replace(/;/g, '')) + endString;

                            finalActualExpressionString = expressionActualString + startString + (setfinalActualExpressionString + '__').replace(/,__/g, '') + endString;

                            finalreferencedFunctionList = (setfinalreferenceFunctionList.repeat(referencedFunctionListCount)).slice(1);

                            finalHtmlVerexpString = finalDisplayExpression;

                            finalNodeInfo = (finalNodeInfoString.repeat(referencedFunctionListCount)).slice(1);
                        }

                    }
                }
            }
        }
    }
}

//TO REMOVE THE UNWANTED PROPERTY

function removeGenerateCommandElements(xmlDoc) {
    const actionElements = xmlDoc.querySelectorAll('action[type="MESXMLCommand"], action[type="CommitMESTransaction"], action[type="StartMESTransaction"], action[type="RollbackMESTransaction"]');
    actionElements.forEach(action => {

        const actions = xmlDoc.getElementsByTagName('action');

        for (let i = 0; i < actions.length; i++) {
            const actionElement = actions[i];
            const actiontype = actionElement.getAttribute('type');
            if (actiontype === "MESXMLCommand") {
                const apiSpListElement = (actionElement.getElementsByTagName('API_SP_list')[0]);
                if (apiSpListElement) {
                    const fetchSpString = (apiSpListElement.innerHTML.match(/<!\[CDATA\[(.*?)\]\]>/s)?.[1] || '');
                    if (fetchSpString) {
                        const containsPeriodOrProduct = (fetchSpstring) => {
                            return fetchSpstring.includes('.') || prodspslist.split(',').some(product => fetchSpstring.includes(product.trim()));
                        };
                        if (!containsPeriodOrProduct(fetchSpString)) {
                            const properties = actionElement.querySelectorAll('properties property');
                            properties.forEach(property => {
                                const name = property.getAttribute('name');
                                if (name !== 'RaiseError' && name !== 'configWebAPI' && name !== 'Allow Specific Error Outputs?') {
                                    property.parentNode.removeChild(property);
                                }
                            });
                            actionElement.setAttribute('type', 'Invoke Web API');
                        }
                    }
                }
            }
            else if (actiontype === "CommitMESTransaction" || actiontype === "StartMESTransaction" || actiontype === "RollbackMESTransaction") {
                const properties = actionElement.querySelectorAll('properties property');
                properties.forEach(property => {
                    const name = property.getAttribute('name');
                    if (name !== 'RaiseError' && name !== 'configWebAPI' && name !== 'Allow Specific Error Outputs?') {
                        property.parentNode.removeChild(property);
                    }
                });
                actionElement.setAttribute('type', 'Invoke Web API');
            }
        }
    });
}

//generateStartXMLVariables

function generateStartXMLVariables(action_name, sp_Name, outputVariable) {
    let customElements;
    let jsonObject;
    let xsdTemplate;
    let sp = CustomSpXmlStractureFromJson.find(item => item.SpName === sp_Name);
    if (sp) {
        customElements = sp.spParams;
        jsonObject = customElements;
        if (!customElements || customElements === "[{}]") {

            xsdTemplate = `<?xml version="1.0" encoding="utf-16"?>
                <xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
                    <xs:element name="root">
                        <xs:complexType>
                            <xs:sequence>
                                <xs:element name="response">
                                    <xs:complexType>
                                        <xs:sequence>
                                        </xs:sequence>
                                    </xs:complexType>
                                </xs:element>
                            </xs:sequence>
                        </xs:complexType>
                    </xs:element>
                </xs:schema>`;
        }
        else {
            xsdTemplate = `<?xml version="1.0" encoding="utf-16"?>
                    <xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
                        <xs:element name="root">
                            <xs:complexType>
                                <xs:sequence>
                                    <xs:element name="response">
                                        <xs:complexType>
                                            <xs:sequence>`;

            jsonObject.forEach(element => {
                let xsdType = element.DataType;

                // Conditional mapping based on DATA_TYPE values
                if (xsdType === "nvarchar" || xsdType === "varchar" || xsdType === "text") {
                    xsdType = "string";
                } else if (xsdType === "int") {
                    xsdType = "integer";
                } else if (xsdType === "datetime") {
                    xsdType = "dateTime";
                } else if (xsdType === "bit") {
                    xsdType = "boolean";
                }
                // Adding each element from the 'customElements' array
                xsdTemplate += `
                                                <xs:element name="${element.ParamName}" type="xs:${xsdType}" />`;
            });


            xsdTemplate += `
                                        </xs:sequence>
                                    </xs:complexType>
                                </xs:element>
                            </xs:sequence>
                        </xs:complexType>
                    </xs:element>
                </xs:schema>`;
        }
    }
    const parser = new DOMParser();
    const xsdDoc = parser.parseFromString(xsdTemplate, "application/xml");

    const actionStartElement = xmlDoc.querySelector("action[name='Start']");
    if (actionStartElement) {
        const propertiesElement = actionStartElement.querySelector("properties");
        if (propertiesElement) {
            const xmlVariables = propertiesElement.querySelectorAll("XmlVariables > XmlVariable");
            xmlVariables.forEach((xmlVariable) => {
                const nameElement = xmlVariable.querySelector("Name");
                if (nameElement && nameElement.textContent === outputVariable) {
                    const schemaElement = xmlVariable.querySelector("Schema");
                    if (schemaElement) {
                        // Clear the existing Schema element content and append the new XSD
                        while (schemaElement.firstChild) {
                            schemaElement.removeChild(schemaElement.firstChild);
                        }
                        // Create a CDATA section with the XSD schema
                        const cdataSection = xsdDoc.createCDATASection(xsdTemplate);

                        // Append the CDATA section to the Schema element
                        schemaElement.appendChild(cdataSection);
                    }
                }
            });
        }
    }
}


function appendStartTransIdVariables() {
    if (createTransIdXMLOutput !== null && createTransIdXMLOutput !== '') {
        const actionStartElement = xmlDoc.querySelector("action[name='Start']");
        if (actionStartElement) {
            const propertiesElement = actionStartElement.querySelector("properties");
            if (propertiesElement) {
                // Check if XmlVariables already exists
                let xmlVariablesElement = propertiesElement.querySelector("XmlVariables");
                const parser = new DOMParser();
                const newXmlDoc = parser.parseFromString(createTransIdXMLOutput, "application/xml");
                const newElement = newXmlDoc.documentElement; // Assuming the root element is what you want
                xmlVariablesElement.appendChild(newElement);
            }
        }
    }
}



function parseCSharpCode(inputCode) {
    const variableDeclarations = [];
    const returnExpressions = [];
    const varPattern = /\b(int|string|double|float|bool|char|var|Int32|String|Boolean|Double|Float|Char)\s+(\w+)\s*=\s*([^;]+)\s*;/gi;
    const returnPattern = /\breturn\s+([^;]+);?/g;

    let match;

    // Match variable declarations
    while ((match = varPattern.exec(inputCode)) !== null) {
        variableDeclarations.push(match[0]);
    }

    // Match return expressions
    while ((match = returnPattern.exec(inputCode)) !== null) {
        returnExpressions.push(match[1].trim());
    }

    if (returnExpressions.length === 0) {
        // If no return statements, return the entire string as `valuesStr`
        let newString = inputCode; // Initialize newString with the original inputCode

        if (inputCode.startsWith(`"`) && inputCode.endsWith(`"`)) {
            // If it ends with `;`, remove both `;` and `"`
            if (inputCode.endsWith(`;"`)) {
                newString = inputCode.slice(1, -2).replace(/\\/g, "\\");
            } else {
                // Just remove the quotes at the start and end
                newString = inputCode.slice(1, -1).replace(/\\/g, "\\");
            }
        }

        return { variablesStr: "", valuesStr: newString.trim() };
    }
    else {
        // Otherwise, build variablesStr and valuesStr normally
        const variablesStr = variableDeclarations.join('\n');
        const valuesStr = returnExpressions.join();
        return { variablesStr, valuesStr };
    }
}



function showConversionStarted() {
    // Server-side: no DOM available. Keep a log for debugging.
    try { console.log('[custom_sp_convert] conversion started'); } catch (e) { }
}

function showConversionCompleted() {
    try { console.log('[custom_sp_convert] conversion completed'); } catch (e) { }
}

function showConversionError(Error) {
    try { console.error('[custom_sp_convert] conversion error:', err); } catch (e) { }
}


// If running in Node, export the startConversion function for server-side usage.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    startConversion: (xmlContent, fileName, fileLength, /* optional metadata param */ metadataString) => {
      // If metadataString is provided, you may need to parse and set any global metadata variables used by the module.
      // But for now, startConversion expects xmlContent and fileName. If metadata is needed we will pass it properly next.
      return startConversion(xmlContent, fileName, fileLength);
    }
  };
}

