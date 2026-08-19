const PDFDocument = require('pdfkit');

function formatarMoeda(valor) {
  return (valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarData(data) {
  if (!data) return '-';
  return new Date(data).toLocaleDateString('pt-BR');
}

const STATUS_LABEL = {
  recebida: 'Recebida',
  em_analise: 'Em análise',
  aguardando_aprovacao: 'Aguardando aprovação',
  em_manutencao: 'Em manutenção',
  finalizada: 'Finalizada',
  entregue: 'Entregue',
  cancelada: 'Cancelada'
};

/**
 * Gera o PDF de uma Ordem de Serviço e escreve no stream de resposta HTTP.
 */
function gerarPdfOrdemServico(os, oficina, res) {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `inline; filename=OS-${os.numero}.pdf`);
  doc.pipe(res);

  doc.fontSize(18).font('Helvetica-Bold').text(oficina?.nomeOficina || 'Oficina de Motos', { align: 'left' });
  doc.fontSize(9).font('Helvetica').text(oficina?.endereco || '');
  doc.text(`Tel: ${oficina?.telefone || '-'}  |  WhatsApp: ${oficina?.whatsapp || '-'}`);
  doc.moveDown(0.5);
  doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
  doc.moveDown();

  doc.fontSize(16).font('Helvetica-Bold').text(`Ordem de Serviço Nº ${os.numero}`, { align: 'right' });
  doc.fontSize(10).font('Helvetica').text(`Status: ${STATUS_LABEL[os.status] || os.status}`, { align: 'right' });
  doc.text(`Data: ${formatarData(os.createdAt)}`, { align: 'right' });
  doc.moveDown();

  doc.fontSize(12).font('Helvetica-Bold').text('Cliente');
  doc.fontSize(10).font('Helvetica');
  doc.text(`Nome: ${os.cliente?.nome || '-'}`);
  doc.text(`Telefone: ${os.cliente?.telefone || '-'}  |  WhatsApp: ${os.cliente?.whatsapp || '-'}`);
  doc.moveDown(0.5);

  doc.fontSize(12).font('Helvetica-Bold').text('Veículo');
  doc.fontSize(10).font('Helvetica');
  doc.text(`${os.moto?.marca || ''} ${os.moto?.modelo || ''} - Placa: ${os.moto?.placa || '-'}`);
  doc.text(`Ano: ${os.moto?.ano || '-'}  |  Cor: ${os.moto?.cor || '-'}  |  KM: ${os.quilometragemEntrada ?? '-'}`);
  doc.moveDown(0.5);

  doc.fontSize(12).font('Helvetica-Bold').text('Problema informado');
  doc.fontSize(10).font('Helvetica').text(os.problemaInformado || '-');
  doc.moveDown(0.3);

  if (os.diagnostico) {
    doc.fontSize(12).font('Helvetica-Bold').text('Diagnóstico');
    doc.fontSize(10).font('Helvetica').text(os.diagnostico);
    doc.moveDown(0.3);
  }

  if (os.pecasUtilizadas?.length) {
    doc.moveDown(0.3);
    doc.fontSize(12).font('Helvetica-Bold').text('Peças utilizadas');
    doc.fontSize(10).font('Helvetica');
    os.pecasUtilizadas.forEach((p) => {
      doc.text(`${p.quantidade}x  ${p.nome}  -  ${formatarMoeda(p.precoUnitario)} un.  =  ${formatarMoeda(p.quantidade * p.precoUnitario)}`);
    });
  }

  if (os.servicosRealizados?.length) {
    doc.moveDown(0.3);
    doc.fontSize(12).font('Helvetica-Bold').text('Serviços realizados');
    doc.fontSize(10).font('Helvetica');
    os.servicosRealizados.forEach((s) => {
      doc.text(`${s.descricao}  -  ${formatarMoeda(s.valor)}`);
    });
  }

  doc.moveDown();
  doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
  doc.moveDown(0.5);

  doc.fontSize(10).font('Helvetica');
  doc.text(`Valor peças: ${formatarMoeda(os.valorPecas)}`, { align: 'right' });
  doc.text(`Valor mão de obra: ${formatarMoeda(os.valorMaoDeObra)}`, { align: 'right' });
  doc.text(`Desconto: ${formatarMoeda(os.desconto)}`, { align: 'right' });
  doc.fontSize(13).font('Helvetica-Bold').text(`Total: ${formatarMoeda(os.total)}`, { align: 'right' });

  doc.moveDown(2);
  doc.fontSize(9).font('Helvetica');
  doc.text('_______________________________________', { align: 'center' });
  doc.text('Assinatura do cliente', { align: 'center' });

  doc.end();
}

module.exports = { gerarPdfOrdemServico };
