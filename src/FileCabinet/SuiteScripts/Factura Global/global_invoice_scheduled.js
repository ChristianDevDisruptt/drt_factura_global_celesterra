/**
 * Author      : Jose Luis Ferrer Garcia
 * Language    : javascript
 * Date        : 10.Nov.2020
 */
/**
 *@NApiVersion 2.x
 *@NScriptType ScheduledScript
 */
define(['N/search', 'N/record', 'N/format', 'N/runtime', 'N/https', 'N/xml', 'N/encode', 'N/config', 'N/task', 'N/xml', 'N/email', 'N/file'],
	function(search, record, format, runtime, https, xml, encode, config, task, xml, email, file) {

		const CONST_ARR_CHART = ['&','"','<','>',"'",'´'];
		const OPERATION       = 'CONVERT_NATIVE_XML';
		const CONST_RECIPIENT = 'lacosta@celesterra.com.mx';
		var jsonData          = null;

		function getSerialNumber ( id ) {
			var schResult = '';

			if ( id === null ) {
				return 'GEN-1000000001';
			}
			var source    = 'customrecord_drt_setup_serial_gi';
			var afilters  = [{name: 'custrecord_drt_num_subsidiary', operator: search.Operator.ANYOF, values: id}];
			var acolumns  = ['custrecord_drt_prefix', 'custrecord_drt_suffix', 'custrecord_drt_current', 'custrecord_drt_initial'];
			var schRecord = search.create({
				type: source, filters: afilters, columns: acolumns
			}).run().each(function(result) {

				if ( result.getValue('custrecord_drt_prefix') ) {
					schResult += result.getValue('custrecord_drt_prefix');
				}
				if ( result.getValue('custrecord_drt_suffix') ) {
					schResult += result.getValue('custrecord_drt_suffix');
				}
				if ( parseInt( result.getValue('custrecord_drt_current') ) == 0 ) {
					schResult += result.getValue('custrecord_drt_initial').toString();
				} else {
					schResult += (result.getValue('custrecord_drt_current') || 1).toString();
				}
				schResult = {
					serial: schResult, id: result.id
				};
			});
			return schResult;
		}

		function getDataSAT( type, id ) {

			var fieldName = 'name';
			if ( type == 'customrecord_mx_sat_payment_term' ) {
				fieldName = 'custrecord_mx_sat_pt_code';
			}
			var result = search.lookupFields({
				type: type, id: id, columns: [fieldName]
			});
			return result.name;
		}

		function getFormatDateXML ( d ) {
			if ( !d ) {
				return '';
			}
			var dd = (d.getDate() + 100).toString().substr(1,2);
			var MM = (d.getMonth() + 101).toString().substr(1,2);
			var yy = d.getFullYear();
			var hh = (parseInt(d.getHours()) + 100).toString().substr(1,2);
			var mm = (parseInt(d.getMinutes()) + 100).toString().substr(1,2);
			var ss = (parseInt(d.getSeconds()) + 100).toString().substr(1,2);

			return yy+'-'+MM+'-'+dd+'T'+hh+':'+mm+':'+ss;
		}

		function getSetupCFDI ( idsub ) {
			var result = null;

			var SUBSIDIARIES = runtime.isFeatureInEffect({
				feature: 'SUBSIDIARIES'
			});

			if ( SUBSIDIARIES && idsub ) {
				// Configuracion de la subsidiaria
				var subsidiary = record.load({
					type: 'subsidiary', id: idsub
				});

				result = {
					rfcemisor: subsidiary.getValue('federalidnumber') || 'XAXX010101000',
					regfiscal: subsidiary.getText('custrecord_mx_sat_industry_type').split('-')[0] || '',
					razonsoc: subsidiary.getValue('name')
				};

			} else if ( !SUBSIDIARIES ) {
				// Configuracion de la compania
				var configRecObj = config.load({
					type: config.Type.COMPANY_INFORMATION
				});

				result = {
					rfcemisor: configRecObj.getValue('employerid') || '',
					regfiscal: configRecObj.getText('custrecord_mx_sat_industry_type').split('-')[0] || '',
					razonsoc: configRecObj.getValue('legalname')
				};
			}
			return result;
		}

		function getXMLHead() {
			// Obtengo el folio de la factura
			if ( !jsonData.idsetfol ) {
				var idsetfol = getSerialNumber( jsonData.subsidiary );
				jsonData.idsetfol = idsetfol.id;
			}

			var xmlDoc = '';
			xmlDoc += '<?xml version="1.0" encoding="UTF-8"?>';
			xmlDoc += '<fx:FactDocMX ';
			xmlDoc += 'xmlns:fx="http://www.fact.com.mx/schema/fx" ';
			xmlDoc += 'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ';
			xmlDoc += 'xsi:schemaLocation="http://www.fact.com.mx/schema/fx http://www.mysuitemex.com/fact/schema/fx_2010_f.xsd">';
			xmlDoc += '  <fx:Version>7</fx:Version>';
			xmlDoc += '  <fx:Identificacion>';
			xmlDoc += '    <fx:CdgPaisEmisor>MX</fx:CdgPaisEmisor>';
			xmlDoc += '    <fx:TipoDeComprobante>FACTURA</fx:TipoDeComprobante>';
			xmlDoc += '    <fx:RFCEmisor>'+ jsonData.rfcemisor +'</fx:RFCEmisor>';
			xmlDoc += '    <fx:RazonSocialEmisor>'+ jsonData.razonsoc +'</fx:RazonSocialEmisor>'; // TECTUS SA DE CV
			xmlDoc += '    <fx:Usuario>TECTUS</fx:Usuario>';
			xmlDoc += '    <fx:AsignacionSolicitada>';
			xmlDoc += '      <fx:Folio>'+ idsetfol.serial +'</fx:Folio>';
			xmlDoc += '      <fx:TiempoDeEmision>'+ jsonData.today +'</fx:TiempoDeEmision>'; // 2020-11-11T00:00:00
			xmlDoc += '    </fx:AsignacionSolicitada>';
			xmlDoc += '    <fx:LugarExpedicion>64780</fx:LugarExpedicion>';
			xmlDoc += '  </fx:Identificacion>';
			xmlDoc += '  <fx:Emisor>';
			xmlDoc += '    <fx:RegimenFiscal>';
			xmlDoc += '      <fx:Regimen>'+ jsonData.regfiscal.split('-')[0].trim() +'</fx:Regimen>'; //601
			xmlDoc += '    </fx:RegimenFiscal>';
			xmlDoc += '  </fx:Emisor>';
			xmlDoc += '  <fx:Receptor>';
			xmlDoc += '    <fx:CdgPaisReceptor>MX</fx:CdgPaisReceptor>';
			xmlDoc += '    <fx:RFCReceptor>'+ jsonData.rfcrecep +'</fx:RFCReceptor>';
			xmlDoc += '    <fx:NombreReceptor>PUBLICO EN GENERAL</fx:NombreReceptor>';
			xmlDoc += '    <fx:UsoCFDI>'+ jsonData.cfdi.split('-')[0].trim() +'</fx:UsoCFDI>'; //P01
			xmlDoc += '  </fx:Receptor>';
			xmlDoc += '  <fx:Conceptos>';

			var totTaxAmount = 0;
			for ( var i = 0; i < jsonData.items.length; i++) {

				var codeItem = jsonData.items[i].itemid;
				var nameItem = jsonData.items[i].name;

				for( var t = 0; t < CONST_ARR_CHART.length; t++) {
					if ( nameItem.indexOf( CONST_ARR_CHART[t] ) >= 0) {
						nameItem = xml.escape({
							xmlText: nameItem
						});
						break;
					}
				}

				for( var t = 0; t < CONST_ARR_CHART.length; t++) {
					if ( codeItem.indexOf( CONST_ARR_CHART[t] ) >= 0) {
						codeItem = xml.escape({
							xmlText: codeItem
						});
						break;
					}
				}

				xmlDoc += '    <fx:Concepto>';
				xmlDoc += '      <fx:Cantidad>'+ jsonData.items[i].quantity +'</fx:Cantidad>';
				xmlDoc += '      <fx:ClaveUnidad>ACT</fx:ClaveUnidad>';
				xmlDoc += '      <fx:UnidadDeMedida>'+ jsonData.items[i].unit +'</fx:UnidadDeMedida>';
				xmlDoc += '      <fx:ClaveProdServ>01010101</fx:ClaveProdServ>';
				xmlDoc += '      <fx:Codigo>'+ codeItem +'</fx:Codigo>';
				xmlDoc += '      <fx:Descripcion>'+ nameItem +'</fx:Descripcion>';
				xmlDoc += '      <fx:ValorUnitario>'+ jsonData.items[i].rate +'</fx:ValorUnitario>';
				xmlDoc += '      <fx:Importe>'+ jsonData.items[i].amount +'</fx:Importe>';
				xmlDoc += '      <fx:Descuento>'+ jsonData.items[i].discount +'</fx:Descuento>';
				xmlDoc += '      <fx:ImpuestosSAT>';
				xmlDoc += '        <fx:Traslados>';
				if ( jsonData.items[i].taxcodeid == 8 ) {
					xmlDoc += '          <fx:Traslado Base="'+jsonData.items[i].amount+'" Impuesto="002" TipoFactor="Exento" />';
				} else {
					xmlDoc += '          <fx:Traslado Base="'+jsonData.items[i].amount+'" Importe="'+jsonData.items[i].taxamt+'" Impuesto="002" TasaOCuota="'+jsonData.items[i].taxrate+'" TipoFactor="Tasa" />';
				}
				xmlDoc += '        </fx:Traslados>';
				xmlDoc += '      </fx:ImpuestosSAT>';
				xmlDoc += '    </fx:Concepto>';
				totTaxAmount += parseFloat( jsonData.items[i].taxamt );
			}

			xmlDoc += '  </fx:Conceptos>';
			xmlDoc += '  <fx:ImpuestosSAT TotalImpuestosTrasladados="'+totTaxAmount.toFixed(2)+'">';
			xmlDoc += '    <fx:Traslados>';
			xmlDoc += '      <fx:Traslado Importe="'+totTaxAmount.toFixed(2)+'" Impuesto="002" TasaOCuota="'+jsonData.items[0].taxrate+'" TipoFactor="Tasa" />';
			xmlDoc += '    </fx:Traslados>';
			xmlDoc += '  </fx:ImpuestosSAT>';
			xmlDoc += '  <fx:Totales>';
			xmlDoc += '    <fx:Moneda>'+ jsonData.currency +'</fx:Moneda>';
			xmlDoc += '    <fx:TipoDeCambioVenta>'+ jsonData.exchange +'</fx:TipoDeCambioVenta>';
			xmlDoc += '    <fx:SubTotalBruto>'+ jsonData.subtot +'</fx:SubTotalBruto>';
			xmlDoc += '    <fx:SubTotal>'+ jsonData.subtot +'</fx:SubTotal>';
			xmlDoc += '    <fx:Descuento>'+ jsonData.destot +'</fx:Descuento>';
			xmlDoc += '    <fx:Total>'+ jsonData.total +'</fx:Total>';
			xmlDoc += '    <fx:TotalEnLetra>-</fx:TotalEnLetra>';
			xmlDoc += '    <fx:FormaDePago>' + jsonData.payform + '</fx:FormaDePago>';
			xmlDoc += '  </fx:Totales>';
			xmlDoc += '  <fx:ComprobanteEx>';
			xmlDoc += '    <fx:TerminosDePago>';
			xmlDoc += '      <fx:MetodoDePago>PUE</fx:MetodoDePago>';
			xmlDoc += '    </fx:TerminosDePago>';
			xmlDoc += '  </fx:ComprobanteEx>';
			xmlDoc += '</fx:FactDocMX>';

			return xmlDoc;
		}

		function getAllRecords() {
			var rangini  = 0;
			var rangend  = 1000;
			var subtot   = 0;
			var taxtot   = 0;
			var total    = 0;
			var destot   = 0;
			var isentry  = true;
			var sourceId = 'customsearch_drt_cashsales_g_cfdi'; //'customsearch_drt_cashsales_global_cfdi';
			// cargo la busqueda guardada
			var searchRecord = search.load({
				id: sourceId
			});

			var today = runtime.getCurrentScript().getParameter('custscript_today') || null;
			if ( !today ) {
				today = new Date();
				today = format.format({
					value: today, type: format.Type.DATE
				});
			} else {
				today = format.format({
					value: today, type: format.Type.DATE
				});
			}

			var filters = searchRecord.filters;
			var afilterOne = search.createFilter({
				name: 'trandate', operator: search.Operator.WITHIN, values: [today, today]});
			filters.push( afilterOne ); 

			var schResultRange = searchRecord.run().getRange({
				start: rangini,
				end: rangend
			});

			do {
				schResultRange.forEach( function( row ) {

					var itemtype    = row.getValue({name: 'type', join: 'item'}).toLowerCase();
					var itemCodeSAT = row.getText('custcol_mx_txn_line_sat_item_code');

					subtot += parseFloat( row.getValue('amount') );
					taxtot += parseFloat( row.getValue('taxamount') );
					total  += parseFloat( row.getValue('grossamount') );

					if ( isentry == true ) {
						jsonData = {
							subsidiary: row.getValue('subsidiary'),
							trandate: row.getValue('trandate'),
							tranid: row.getValue('tranid'),
							entity: row.getText('entity'),
							rfcrecep: 'XAXX010101000', //row.getValue('custbody_mx_customer_rfc'),
							currency: 'MXN',
							exchange: parseInt( row.getValue('exchangerate') ),
							subtot: 0,
							taxtot: 0,
							total: 0,
							destot: 0,
							cfdi: '',
							payform: '',
							paymeth: '',
							rfcemisor: '',
							today: '',
							regfiscal: '',
							idsetfol: '',
							items: [{
								itemid: row.getText('item'),
								name: row.getValue({name: 'salesdescription', join: 'item'}),
								quantity: row.getValue('quantity'),
								unit: row.getValue('unit'),
								taxcodeid: row.getValue('taxcode'),
								taxcode: row.getText('taxcode'),
								taxrate: '0.160000',
								rate: parseFloat( row.getValue('rate') ).toFixed(2),
								taxamt: parseFloat( row.getValue('taxamount') ).toFixed(2),
								amount: parseFloat( row.getValue('amount') ).toFixed(2),
								discount: parseFloat(row.getValue('discountamount') || 0).toFixed(2),
								satcode: itemCodeSAT,
								idcashsales: row.id
							}]
						};
						isentry = false;

					} else {
						jsonData.items.push({
							itemid: row.getText('item'),
							name: row.getValue({name: 'salesdescription', join: 'item'}),
							quantity: row.getValue('quantity'),
							unit: row.getValue('unit'),
							taxcodeid: row.getValue('taxcode'),
							taxcode: row.getText('taxcode'),
							taxrate: '0.160000',
							rate: parseFloat( row.getValue('rate') ).toFixed(2),
							taxamt: parseFloat( row.getValue('taxamount') ).toFixed(2),
							amount: parseFloat( row.getValue('amount') ).toFixed(2),
							discount: parseFloat(row.getValue('discountamount') || 0).toFixed(2),
							satcode: itemCodeSAT,
							idcashsales: row.id
						});
					}
				});
				rangini = rangend;
				rangend += 1000;
				schResultRange = searchRecord.run().getRange({
					start: rangini,
					end: rangend
				});

			} while ( schResultRange.length > 0 );

			if ( jsonData ) {
				jsonData.subtot = subtot.toFixed(2);
				jsonData.taxtot = taxtot.toFixed(2);
				jsonData.total  = ( (total + taxtot) - destot ).toFixed(2);
				jsonData.destot = destot.toFixed(2);
			}
		}

		function createFileXML( xml ) {

			var date = new Date();
			date = getFormatDateXML( date );

			var fileObj = file.create({
				name: 'XML'+date,
				fileType: file.Type.XMLDOC,
				contents: xml,
				description: 'XML SAT',
				encoding: file.Encoding.UTF8,
				folder: 1899,
				isOnline: true
			});
			var fileId = fileObj.save();
			return fileId;
		}

		function execute(context) {

			try {
				// obtengo la transaccion
				getAllRecords();

				if ( !jsonData ) {
					log.debug('Message', 'No se encontraron resultados en la busqueda.');
					return;
				}
				var resultGUID = runtime.getCurrentScript().getParameter('custscript_uuid') || null;
				if ( runtime.getCurrentScript().getParameter('custscript_folio') ) {
					jsonData.idsetfol = runtime.getCurrentScript().getParameter('custscript_folio');
				}

				log.debug('resultGUID', resultGUID);

				jsonData.cfdi    = getDataSAT('customrecord_mx_sat_cfdi_usage', runtime.getCurrentScript().getParameter('custscript_usagecfdi'));
				jsonData.payform = '01'; //runtime.getCurrentScript().getParameter('custscript_payform_sat');
				jsonData.paymeth = getDataSAT('customrecord_mx_mapper_values', runtime.getCurrentScript().getParameter('custscript_paymethod_sat'));
				// formateo la fecha de registro
				var today = new Date();
				if ( runtime.getCurrentScript().getParameter('custscript_createdate') ) {
					today = runtime.getCurrentScript().getParameter('custscript_createdate');
				}
				jsonData.today = getFormatDateXML( today );

				var setupConfig = getSetupCFDI( jsonData.subsidiary );
				if ( setupConfig ) {
					jsonData.rfcemisor = setupConfig.rfcemisor;
					jsonData.regfiscal = setupConfig.regfiscal;
					jsonData.razonsoc  = setupConfig.razonsoc;
				}
				// Cargo la configuracion del PAC
				var mySuiteConfig = record.load({
					type: 'customrecord_mx_pac_connect_info', id: 3
				});
				var url       = mySuiteConfig.getValue('custrecord_mx_pacinfo_url');
				var idFiscal  = mySuiteConfig.getValue('custrecord_mx_pacinfo_taxid');
				var userName  = 'ADMIN'; //mySuiteConfig.getValue('custrecord_mx_pacinfo_username')
				var requestor = '';
				var user      = '';

				switch ( jsonData.rfcemisor ) {
					case 'CEL110624QJ1':
						// Celesterra SA de CV
						requestor = 'cfe3d1dc-3033-4cd0-aafc-5e92096562ef';
						user = 'cfe3d1dc-3033-4cd0-aafc-5e92096562ef';
						break;
					case 'TEC101020TD8':
						// Tectus SA de CV
						requestor = 'f7599d94-e14b-49d8-a6b8-72a41cd03d54';
						user = 'f7599d94-e14b-49d8-a6b8-72a41cd03d54';
						break;
					case 'CNI081204RD9':
						// Comercializadora nindaranna SA de CV
						requestor = '43efeecf-d831-4003-89a2-1e3152114aba';
						user = '43efeecf-d831-4003-89a2-1e3152114aba';
						break;
					case 'CER061114GV1':
						// Comercializadora erectus SA de CV
						requestor = '91e33274-d449-44f8-a451-76b9ada7c141';
						user = '91e33274-d449-44f8-a451-76b9ada7c141';
						break;
					default:
						// 'XAXX010101000'
						requestor = '0c320b03-d4f1-47bc-9fb4-77995f9bf33e';
						user = '0c320b03-d4f1-47bc-9fb4-77995f9bf33e';
						break;
				}

				if ( !resultGUID ) {
					// armo el xml
					var xmlStr = getXMLHead();
					var idFileXML = createFileXML( xmlStr );

					// convertir el xml a base 64
					var xmlStrB64 = encode.convert({
						string: xmlStr,
						inputEncoding: encode.Encoding.UTF_8,
						outputEncoding: encode.Encoding.BASE_64
					});
					// Envio el xml
					var req = '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ws="http://www.fact.com.mx/schema/ws">';
					req +='   <soapenv:Header/>';
					req +='   <soapenv:Body>';
					req +='      <ws:RequestTransaction>';
					req +='         <ws:Requestor>'+ requestor +'</ws:Requestor>';
					req +='         <ws:Transaction>'+ OPERATION +'</ws:Transaction>';
					req +='         <ws:Country>MX</ws:Country>';
					req +='         <ws:Entity>' + jsonData.rfcemisor + '</ws:Entity>';
					req +='         <ws:User>' + user + '</ws:User>';
					req +='         <ws:UserName>'+ userName +'</ws:UserName>';
					req +='         <ws:Data1> '+ xmlStrB64 +' </ws:Data1>';
					req +='         <ws:Data2>PDF XML</ws:Data2>';
					req +='         <ws:Data3></ws:Data3>';
					req +='      </ws:RequestTransaction>';
					req +='   </soapenv:Body>';
					req +='</soapenv:Envelope>';

					var headers = {
						'Content-Type': 'text/xml; charset=utf-8',
						'Content-Length': '"' + req.length + '"',
						'SOAPAction': 'http://www.fact.com.mx/schema/ws/RequestTransaction',
					};

					var serviceResponse = https.post({
						url: url, body: req, headers: headers
					});
					// Obtengo el resultado
					var responseText = serviceResponse.body;
					var xml_response = xml.Parser.fromString({
						text: responseText
					});

					var nodeResponse = xml_response.getElementsByTagName({
						tagName: 'Response'
					})[0];
					// verifico el resultado de la solicitud
					var result = nodeResponse.getElementsByTagName({
						tagName: 'Result'
					})[0].textContent;

					if ( result == 'false') {
						var description = nodeResponse.getElementsByTagName({
							tagName: 'Data'
						})[0].textContent;

						log.audit('FALLA_DE_VALIDACION_SAT', description);
						return;
					} else {

						// proceso de forma correcta
						resultGUID = nodeResponse.getElementsByTagName({
							tagName: 'DocumentGUID'
						})[0].textContent;

						var responseData1 = xml_response.getElementsByTagName({
							tagName: 'ResponseData1'
						})[0].textContent;

						var responseData2 = xml_response.getElementsByTagName({
							tagName: 'ResponseData3'
						})[0].textContent;

						var newRecord = record.create({
							type: 'customrecord_drt_global_invoice_response',
							isDynamic: true
						});
						// Agrego el registro personalizado
						newRecord.setValue({fieldId: 'custrecord_drt_json_data', value: JSON.stringify( jsonData )});
						newRecord.setValue({fieldId: 'custrecord_drt_base64_xml', value: responseData1});
						//newRecord.setValue({fieldId: 'custrecord_drt_base64_pdf', value: responseData2});
						if ( idFileXML ) {
							newRecord.setValue({fieldId: 'custrecord_drt_doc_xml', value: idFileXML});
						}
						newRecord.setValue({fieldId: 'custrecord_drt_guid', value: resultGUID});
						var recordId = newRecord.save({
							enableSourcing: true, ignoreMandatoryFields: true
						});

					}
				}

				// Actualizo las transaaciones con los datos de la factura global
				for( var i = 0; i < jsonData.items.length; i++ ) {

					if ( runtime.getCurrentScript().getRemainingUsage() <=3000 && (i+1) < jsonData.items.length ) {
						var status = task.create ({
							taskType: task.TaskType.SCHEDULED_SCRIPT,
							scriptId: runtime.getCurrentScript().id,
							deploymentId: runtime.getCurrentScript().deploymentId,
							params: {custscript_uuid: resultGUID, custscript_folio: jsonData.idsetfol}
						});
						if (status == 'QUEUED') {
							return;
						}
					}
					var value1 = runtime.getCurrentScript().getParameter('custscript_usagecfdi');
					var value2 = runtime.getCurrentScript().getParameter('custscript_payform_sat');
					var value3 = runtime.getCurrentScript().getParameter('custscript_paymethod_sat');

					var id = record.submitFields({
						type: record.Type.CASH_SALE, id: jsonData.items[i].idcashsales, values: {
							custbody_mx_cfdi_uuid: resultGUID,
							custbody_mx_cfdi_usage: value1,
							custbody_mx_txn_sat_payment_method: value2,
							custbody_mx_txn_sat_payment_term: value3,
						}, options: {
							enableSourcing: true, ignoreMandatoryFields : true
						}
					});

				}
				// actualizo el numero de serie
				if ( jsonData.idsetfol ) {
					var crSerial = search.lookupFields({
						type: 'customrecord_drt_setup_serial_gi', id: jsonData.idsetfol, columns: ['custrecord_drt_current']
					});
					var nextNumber = crSerial.custrecord_drt_current || 1;
					nextNumber ++;
					var id = record.submitFields({
						type: 'customrecord_drt_setup_serial_gi', id: jsonData.idsetfol, values: {
							custrecord_drt_current: nextNumber
						}
					});
				}
				log.audit('Proceso Finalizado...');

			} catch ( err ) {
				log.debug('Error', err.message );

				email.send({
					author: -5,
					recipients: CONST_RECIPIENT,
					subject: 'Error Global Invoice',
					body: err.message
				});

			}
		}

		return{
			execute: execute
		};
	});