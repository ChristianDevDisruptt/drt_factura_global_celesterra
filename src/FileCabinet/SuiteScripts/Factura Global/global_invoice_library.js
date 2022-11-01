/**
 * Author      : Jose Luis Ferrer Garcia
 * Language    : javascript
 * Date        : 10.Nov.2020
 */
/**
 * @NApiVersion 2.x
 */
define(['N/search', 'N/config', 'N/record'],

	function( search, config, record ) {
		const CONST_SUBSIDIARY = 9;

		/**
		 * [getAllTransaction description]
		 * @param  {[type]} params [description]
		 * @return {[type]}        [description]
		 */
		function getAllTransaction ( params ) {
			var resultSearch = null;
			var rangini      = 0;
			var rangend      = 1000;

			if ( !params.datesearch || params.datesearch === '' ) {
				return resultSearch;
			}

			try {
				var afilters = [{name: 'type', operator: search.Operator.ANYOF, values: 'CashSale'}];
				afilters.push({name: 'custbody_mx_cfdi_uuid', operator: search.Operator.ISEMPTY});
				//afilters.push({name: 'status', operator: search.Operator.ANYOF, values: 'CashSale:C'});
				afilters.push({name: 'mainline', operator: search.Operator.IS, values: true});
				afilters.push({name: 'subsidiary', operator: search.Operator.ANYOF, values: CONST_SUBSIDIARY});
				afilters.push({name: 'voided', operator: search.Operator.IS, values: false});

				if ( params.datesearch ) {
					afilters.push({name: 'trandate', operator: search.Operator.WITHIN, values: [params.datesearch, params.datesearch]});
				}

				var acolumns = ['tranid', 'trandate', 'entity', 'fxamount'];
				var schRecord = search.create({
					type: 'cashsale', filters: afilters, columns: acolumns,
				});

				var schResultRange = schRecord.run().getRange({
					start: rangini,
					end: rangend
				});

				do {
					schResultRange.forEach( function( row ) {

						if ( !resultSearch ) {
							resultSearch = [];
						}
						resultSearch.push({
							id: row.id,
							trandate: row.getValue('trandate'),
							tranid: row.getValue('tranid'),
							fxamount: row.getValue('fxamount'),
							name: row.getText('entity')
						});
					});
					rangini = rangend;
					rangend += 1000;
					schResultRange = schRecord.run().getRange({
						start: rangini,
						end: rangend
					});
				} while ( schResultRange.length > 0 );

			} catch ( err ) {
				log.error('Error', err.message );
			}
			return resultSearch;
		}
		/**
		 * [getFilebyName description]
		 * @param  {[type]} filename [description]
		 * @return {[type]}          [description]
		 */
		function getFilebyName ( filename ) {
			var fileId   = null;
			var afilters = [{name: 'name', operator: search.Operator.IS, values: filename}];
			var acolumns = ['folder'];

			search.create({
				type: 'file',
				columns: acolumns,
				filters: afilters
			}).run().each( function( r ) {
				fileId = r.id;
			});
			return fileId;
		}
		/**
		 * [getTranslate description]
		 * @return {[type]} [description]
		 */
		function getTranslate () {
			var userPrefer = config.load({
				type: config.Type.USER_PREFERENCES
			});
			var defaultHelpE = 'This is a custom field created for your account. Contact your administrator for details.';
			var defaultHelpS = 'Este es un campo personalizado creado para su cuenta. Comuníquese con su administrador para obtener más detalles.';
			var expreg     = /es/;
			var strlang    = expreg.test( userPrefer.getValue( 'LANGUAGE' ) );
			var label = {
				form: strlang == true? 'Facturación Global': 'Invoice Massive',
				label1: strlang == true? 'Fecha Emision XML': 'XML Issue Date',
				label2: strlang == true? 'Uso CFDI': 'CFDI Usage',
				label3: strlang == true? 'Metodo de Pago SAT': 'SAT Payment Method',
				label4: strlang == true? 'Forma de Pago SAT': 'SAT Payment Term',
				label5: strlang == true? 'Fecha': 'Date',
				label6: strlang == true? 'Registros': 'Records',
				sublist: strlang == true? 'Transacciones': 'Transaction',
				column1: strlang == true? 'Selecciona': 'Select',
				column2: strlang == true? 'Documento': 'Document',
				column3: strlang == true? 'Fecha': 'Date',
				column4: strlang == true? 'Nombre': 'Name',
				column5: strlang == true? 'Importe': 'Import',
				help1: strlang == true? defaultHelpS: defaultHelpE,
				help2: strlang == true? defaultHelpS: defaultHelpE,
				help3: strlang == true? defaultHelpS: defaultHelpE,
				help4: strlang == true? defaultHelpS: defaultHelpE,
				help5: strlang == true? defaultHelpS: defaultHelpE,
				help6: strlang == true? defaultHelpS: defaultHelpE,
				help7: strlang == true? defaultHelpS: defaultHelpE,
				message1: strlang == true? 'El proceso se ha ejecutado, la actualización puede tardar algunos minutos.': 'The process has run, the update may take some minutes.',
				button1: strlang == true? 'Buscar': 'Search',
				button2: strlang == true? 'Generar Documento Electrónico': 'Generate Electronic Document',
				button3: strlang == true? 'Certificar Documento Electrónico': 'Certify Electronic Document',
				button4: strlang == true? 'Enviar': 'Send'
			};
			return label;
		}

		return {
			getAllTransaction: getAllTransaction,
			getFilebyName: getFilebyName,
			getTranslate: getTranslate,
		};
	});