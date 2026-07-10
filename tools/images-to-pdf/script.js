// 画質スライダーの値を表示する
document.getElementById('quality').addEventListener('input', (event) => {
    document.getElementById('qualityValue').textContent = event.target.value;
});

document.getElementById('compressButton').addEventListener('click', async () => {
    const fileInput = document.getElementById('pdfUpload');
    const widthSelect = document.getElementById('widthSelect');
    const selectedWidth = widthSelect.value;
    const jpgConversion = document.getElementById('jpgConversion').checked;
    const quality = document.getElementById('quality').value / 100;
    const customFileName = document.getElementById('fileName').value.trim();

    if (!fileInput.files || fileInput.files.length === 0) {
        alert('画像ファイルを選択してください。');
        return;
    }

    const files = Array.from(fileInput.files);
    
    // 全入力ファイルの合計サイズを計算
    let totalOriginalSize = 0;
    for (const file of files) {
        totalOriginalSize += file.size;
    }
    
    const originalSizeMB = (totalOriginalSize / (1024 * 1024)).toFixed(2);
    const originalSizeKB = (totalOriginalSize / 1024).toFixed(2);
    document.getElementById('originalSize').textContent = `${originalSizeMB}MB (${originalSizeKB}KB)`;

    try {
        // 新しいPDFドキュメントの作成
        const pdfDoc = await PDFLib.PDFDocument.create();
        const aspectRatioErrors = [];
        let baseAspectRatio;

        // スマホのメモリ負荷軽減のため、1枚ずつ同期的にループ処理
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const pageNum = i + 1; // 1つの画像 = 1ページ

            // 画像の読み込み処理
            const img = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                    const imageObj = new Image();
                    imageObj.onload = () => resolve(imageObj);
                    imageObj.onerror = reject;
                    imageObj.src = e.target.result;
                };
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });

            const originalWidth = img.width;
            const originalHeight = img.height;

            let canvasWidth = originalWidth;
            let canvasHeight = originalHeight;

            // リサイズ計算
            if (selectedWidth !== 'original') {
                canvasWidth = parseInt(selectedWidth);
                const aspectRatio = originalHeight / originalWidth;
                canvasHeight = canvasWidth * aspectRatio;
            }

            // 【こだわり仕様】2枚目（インデックス1）の画像サイズを基準にする
            if (pageNum === 2) {
                baseAspectRatio = originalHeight / originalWidth;
            }

            // Canvasへの描画と圧縮
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
            context.drawImage(img, 0, 0, canvasWidth, canvasHeight);

            // 指定フォーマットでBlob化
            const imageBlob = await new Promise((resolve) => {
                canvas.toBlob(resolve, jpgConversion ? 'image/jpeg' : 'image/png', quality);
            });

            const imageArrayBuffer = await imageBlob.arrayBuffer();
            const pdfImage = jpgConversion
                ? await pdfDoc.embedJpg(imageArrayBuffer)
                : await pdfDoc.embedPng(imageArrayBuffer);

            // PDFにページを追加して画像を配置
            const newPage = pdfDoc.addPage([canvasWidth, canvasHeight]);
            newPage.drawImage(pdfImage, { x: 0, y: 0, width: canvasWidth, height: canvasHeight });

            // 2枚目を基準にしたアスペクト比チェック（1枚目はスキップ）
            if (baseAspectRatio && pageNum !== 2) {
                const currentAspectRatio = originalHeight / originalWidth;
                if (Math.abs(currentAspectRatio - baseAspectRatio) > 0.01) {
                    aspectRatioErrors.push(pageNum);
                }
            }
        }

        // PDFの保存処理
        const pdfBytes = await pdfDoc.save();
        const compressedFileSize = pdfBytes.byteLength;
        const compressedSizeMB = (compressedFileSize / (1024 * 1024)).toFixed(2);
        const compressedSizeKB = (compressedFileSize / 1024).toFixed(2);
        document.getElementById('compressedSize').textContent = `${compressedSizeMB}MB (${compressedSizeKB}KB)`;

        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const saveButton = document.getElementById('saveButton');

        // 保存ボタンの有効化とイベント設定
        saveButton.disabled = false;
        
        // 重複登録を防ぐため、古いイベントリスナーをクリアして再設定
        const newSaveButton = saveButton.cloneNode(true);
        saveButton.parentNode.replaceChild(newSaveButton, saveButton);
        
        newSaveButton.addEventListener('click', () => {
            const finalFileName = customFileName ? `${customFileName}.pdf` : 'output.pdf';
            saveAs(blob, finalFileName);
        });

        // 警告表示
        const aspectRatioWarning = document.getElementById('aspectRatioWarning');
        if (aspectRatioErrors.length > 0) {
            aspectRatioWarning.textContent = `サイズが統一されていません。 (${aspectRatioErrors.join(', ')}枚目の画像)`;
        } else {
            aspectRatioWarning.textContent = '';
        }

    } catch (error) {
        console.error("Error processing Images to PDF:", error);
        alert('処理中にエラーが発生しました。画像の形式などを確認してください。');
    }
});
