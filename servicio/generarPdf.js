const puppeteer = require('puppeteer-core');

async function genTablePDF(data, headers, archivo, titulo) {
  try {
    const browser = await puppeteer.launch({
      // Ruta típica de Chrome en Windows. Cámbiala si usas Edge o si está en otra ruta.
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage' // Evita caídas por falta de memoria en Windows
      ]
    });
    var datos = "<html><head><style>body{padding:20px}";
    datos += "table{font-family:Tahoma;font-size:12px;border-collapse:collapse;}";
    datos += "table thead tr th{border:solid 0.5pt #aaa;background:#ddd;}";
    datos += "table tbody tr td{padding:4px;border:solid 0.5pt #aaa}</style></head><body>";
    datos += "<h1>" + titulo + "</h1><br><br>"
    datos += "<table width='90%'><head><tr>";
    for (var i = 0; i < headers.length; i++) {
      datos += "<th style='border:solid 0.5pt #aaa;background:#ddd;'>" + headers[i] + "</th>"
    }
    datos += "</tr></thead><tbody>"
    for (var i = 0; i < data.length; i++) {
      datos += "<tr>";
      for (var j = 0; j < headers.length; j++) {
        datos += "<td>" + data[i][j] + "</td>"
      }
      datos += "</tr>"
    }
    datos += "</tbody></table></body></html>"


    const page = await browser.newPage();
    await page.setContent(datos);
    await page.pdf({ path: process.env.TMP_PATH + archivo + '.pdf', format: 'A4' });
    await browser.close();
  }
  catch (e) { console.log(e) }
}

module.exports = {
  genTablePDF
};
