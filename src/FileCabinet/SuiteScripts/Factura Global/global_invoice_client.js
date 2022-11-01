/**
 * Author      : Jose Luis Ferrer Garcia
 * Language    : javascript
 * Date        : 10.Nov.2020
 */
/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope Public
 */
define(['N/currentRecord', 'N/url', 'N/format', 'N/ui/message'],

	function( currentRecord, url, format, message ) {

		function pageInit() {}

		function saveRecord( context ) {
			var rec = currentRecord.get();

			if ( !rec.getValue('custpage_usecfdi') ) {
				showMessage( 'Capture el valor para el campo Uso de CFDI.' );
				return false;
			}

			if ( !rec.getValue('custpage_paymhetod') ) {
				showMessage( 'Capture el valor para el campo Methodo de pago.' );
				return false;
			}

			if ( !rec.getValue('custpage_payform') ) {
				showMessage( 'Capture el valor para el campo Forma de Pago.' );
				return false;
			}

			if ( !rec.getValue('custpage_dateini') ) {
				showMessage( 'Capture el valor para el campo Fecha.' );
				return false;
			}

			var sublistName = 'custpage_transactions';
			var rows        = rec.getLineCount({ sublistId: sublistName });

			if ( rows == 0 ) {
				showMessage( 'No hay registros a Procesar.' );
				return false;
			}
			return true;
		}
		/**
		 * [reloadForm description]
		 * @param  {[type]} scId [description]
		 * @param  {[type]} dpId [description]
		 * @return {[type]}      [description]
		 */
		function reloadForm ( scId, dpId ) {
			debugger;
			var rec = currentRecord.get();
			// mando los parametros al suitelet
			var trandate = '';
			if ( rec.getValue('custpage_dateini') ) {
				trandate = format.format({value: rec.getValue('custpage_dateini'), type: format.Type.DATE}) || '';
			}
			var created = '';
			if ( rec.getValue('custpage_createdate') ) {
				created = format.format({value: rec.getValue('custpage_createdate'), type: format.Type.DATE}) || '';
			}
			var ucfdi     = rec.getValue('custpage_usecfdi') || null;
			var paymethod = rec.getValue('custpage_paymhetod') || null;
			var payformat = rec.getValue('custpage_payform') || null;

			var script = url.resolveScript({
				scriptId: scId,
				deploymentId: dpId,
				returnExternalUrl: false,
				params: {
					pds: trandate, pdc: created, ucfdi: ucfdi, pm: paymethod, pf: payformat
				}
			});
			// refresco la pantalla
			window.onbeforeunload = false;
			window.location.href  = script;
		}
		/**
		 * [showMessage description]
		 * @param  {[type]} msg [description]
		 * @return {[type]}     [description]
		 */
		function showMessage( msg, time ) {
			if ( !msg ) {
				return;
			}
			if ( !time ) {
				time = 3000;
			}
			var myMessage = message.create({
				title: 'WARNING', message: msg, type: message.Type.WARNING
			});
			myMessage.show({ duration: time });
		}

		return {
			pageInit: pageInit,
			saveRecord: saveRecord,
			reloadForm: reloadForm
		};
	});