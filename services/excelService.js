const ExcelJS = require('exceljs');

/**
 * Gera uma planilha Excel a partir de colunas e linhas e envia como resposta HTTP.
 * @param {object} res - objeto de resposta Express
 * @param {string} nomeArquivo - nome do arquivo sem extensão
 * @param {string} tituloAba - nome da aba
 * @param {Array<{header:string,key:string,width?:number}>} colunas
 * @param {Array<object>} linhas
 */
async function exportarExcel(res, nomeArquivo, tituloAba, colunas, linhas) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Oficina ERP';
  workbook.created = new Date();

  const planilha = workbook.addWorksheet(tituloAba);
  planilha.columns = colunas;

  planilha.getRow(1).font = { bold: true };
  planilha.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E293B' }
  };
  planilha.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

  linhas.forEach((linha) => planilha.addRow(linha));

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader('Content-Disposition', `attachment; filename=${nomeArquivo}.xlsx`);

  await workbook.xlsx.write(res);
  res.end();
}

module.exports = { exportarExcel };
