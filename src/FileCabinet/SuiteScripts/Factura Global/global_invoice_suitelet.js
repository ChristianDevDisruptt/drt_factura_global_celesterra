/**
 * Author      : Jose Luis Ferrer Garcia
 * Language    : javascript
 * Date        : 10.Nov.2020
 */
/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 */
define(['N/ui/serverWidget', 'N/runtime', 'N/error', 'N/format', 'N/task', 'N/redirect', 'N/ui/message', './global_invoice_library'],

	function( ui, runtime, error, format, task, redirect, message, lib ) {

		const sourceCFDI      = 'customrecord_mx_sat_cfdi_usage';
		const sourceList3     = 'customrecord_mx_mapper_values';
		const sourcePayMet    = 'customrecord_mx_sat_payment_term';
		const scheduledScript = 'customscript_drt_global_invoice_schedule';
		const scheduledDeploy = 'customdeploy2';

		function createForm ( context ) {

			var oScript = context.request.parameters;
			var oLabels = lib.getTranslate();
			var form    = ui.createForm({
				title: oLabels.form
			});

			var params = {
				datesearch: oScript.pds || '',
				datecreate: oScript.pdc || '',
				usecfdi: oScript.ucfdi || null,
				paymentf: oScript.pf || null,
				paymentm: oScript.pm || null
			};

			if ( oScript.custparam_message == 'processed' ) {
				form.addPageInitMessage({type: message.Type.INFORMATION, message: oLabels.message1, duration: 5000});
			}
			// Asigno un script de cliente
			var script              = lib.getFilebyName( 'global_invoice_client.js' );
			form.clientScriptFileId = script;

			// campos principales
			// Fecha
			field = form.addField({
				id: 'custpage_dateini', type: ui.FieldType.DATE, label: oLabels.label5
			});
			field.setHelpText({help: oLabels.help5});
			field.updateDisplaySize({height : 60, width: 100});
			field.defaultValue = params.datesearch;

			field = form.addField({
				id: 'custpage_createdate', type: ui.FieldType.DATE, label: oLabels.label1
			});
			field.setHelpText({help: oLabels.help5});
			field.updateDisplaySize({height : 60, width: 100});
			field.defaultValue = params.datecreate;

			// Uso CFDI
			var field = form.addField({
				id: 'custpage_usecfdi', type: ui.FieldType.SELECT, label: oLabels.label2, source: sourceCFDI
			});
			field.setHelpText({help: oLabels.help2});
			field.updateBreakType({breakType: ui.FieldBreakType.STARTCOL});
			field.defaultValue = params.usecfdi || 22;

			field = form.addField({
				id: 'custpage_paymhetod', type: ui.FieldType.SELECT, label: oLabels.label3, source: sourceList3
			});
			field.setHelpText({help: oLabels.help3});
			field.defaultValue = params.paymentm || 1;

			field = form.addField({
				id: 'custpage_payform', type: ui.FieldType.SELECT, label: oLabels.label4, source: sourcePayMet
			});
			field.setHelpText({help: oLabels.help4});
			field.defaultValue = params.paymentf || 3;

			// Crea la sub lista
			var sublist = form.addSublist({
				id: 'custpage_transactions', type: ui.SublistType.LIST, label: oLabels.sublist
			});

			sublist.addField({
				id: 'custpage_tranid', type: ui.FieldType.TEXT, label: oLabels.column2
			});
			sublist.addField({
				id: 'custpage_trandate', type: ui.FieldType.TEXT, label: oLabels.column3
			});
			sublist.addField({
				id: 'custpage_name', type: ui.FieldType.TEXT, label: oLabels.column4
			});
			sublist.addField({
				id: 'custpage_fxamount', type: ui.FieldType.CURRENCY, label: oLabels.column5
			});
			sublist.addField({
				id: 'custpage_internalid', type: ui.FieldType.TEXT, label: 'Internalid'
			}).updateDisplayType({displayType : ui.FieldDisplayType.HIDDEN});

			var field = form.addField({
				id: 'custpage_rows', type: ui.FieldType.INTEGER, label: oLabels.label6
			});
			field.updateDisplayType({displayType: ui.FieldDisplayType.INLINE});
			field.updateBreakType({breakType: ui.FieldBreakType.STARTCOL});

			try{
				var getTransaction = lib.getAllTransaction( params );
				if ( getTransaction && getTransaction.length > 0 ) {
					var row = 0;
					for ( var i = 0; i < getTransaction.length; i++ ) {
						var records = getTransaction[i];
						sublist.setSublistValue({id: 'custpage_trandate', line: row, value: records.trandate});
						sublist.setSublistValue({id: 'custpage_tranid', line: row, value: records.tranid});
						sublist.setSublistValue({id: 'custpage_name', line: row, value: records.name});
						sublist.setSublistValue({id: 'custpage_fxamount', line: row, value: records.fxamount});
						sublist.setSublistValue({id: 'custpage_internalid', line: row, value: records.id});
						row ++;
					}

					field.defaultValue = row;
				}
			} catch( err ) {
				log.debug( 'Error', err.message );
			}

			var strFuncName = 'reloadForm("' + oScript.script + '","' + oScript.deploy + '")';
			form.addButton({
				id: 'custpage_search',
				label:  oLabels.button1,
				functionName: strFuncName
			});

			form.addSubmitButton({
				label: oLabels.button4
			});

			context.response.writePage( form );
		}

		function onRequest( context ) {

			if (context.request.method === 'GET') {
				createForm( context );
			}

			if (context.request.method === 'POST') {
				var oLabels = lib.getTranslate();
				var obj = context.request.parameters;

				if( !obj.custpage_createdate ) {
					obj.custpage_createdate = new Date();
				}
				obj.custpage_createdate = format.format({value: obj.custpage_createdate, type: format.Type.DATE});

				if( !obj.custpage_trandate ) {
					obj.custpage_trandate = new Date();
				}
				obj.custpage_trandate = format.format({value: obj.custpage_trandate, type: format.Type.DATE});

				var params = {
					custscript_uuid: null,
					custscript_usagecfdi: obj.custpage_usecfdi,
					custscript_paymethod_sat: obj.custpage_payform,
					custscript_payform_sat: obj.custpage_paymhetod,
					custscript_createdate: obj.custpage_createdate,
					custscript_today: obj.custpage_dateini,
					custscript_folio: null
				};

				try{
					var scriptTask          = task.create({taskType: task.TaskType.SCHEDULED_SCRIPT});
					scriptTask.scriptId     = scheduledScript;
					scriptTask.deploymentId = scheduledDeploy;
					scriptTask.params       = params;
					var scriptTaskId        = scriptTask.submit();
					redirect.toSuitelet({
						scriptId:'customscript_global_invoice_suitelet',
						deploymentId:'customdeploy1',
						parameters: {'custparam_message': 'processed'}
					});
				} catch (err) {
					throw error.create({
						name: err.name, message: err.message
					});
				}
			}
		}

		return {
			onRequest: onRequest
		};
	});