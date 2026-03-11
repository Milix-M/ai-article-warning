document.addEventListener('DOMContentLoaded', async () => {
  // 設定を読み込み
  const settings = await chrome.storage.local.get({
    threshold: 5,
    showDetails: true,
    enableZenn: true,
    enableQiita: true
  });

  // UIに反映
  document.getElementById('threshold').value = settings.threshold;
  document.getElementById('show-details').checked = settings.showDetails;
  document.getElementById('enable-zenn').checked = settings.enableZenn;
  document.getElementById('enable-qiita').checked = settings.enableQiita;

  // 設定変更を保存
  document.getElementById('threshold').addEventListener('change', (e) => {
    chrome.storage.local.set({ threshold: parseInt(e.target.value) });
  });

  document.getElementById('show-details').addEventListener('change', (e) => {
    chrome.storage.local.set({ showDetails: e.target.checked });
  });

  document.getElementById('enable-zenn').addEventListener('change', (e) => {
    chrome.storage.local.set({ enableZenn: e.target.checked });
  });

  document.getElementById('enable-qiita').addEventListener('change', (e) => {
    chrome.storage.local.set({ enableQiita: e.target.checked });
  });

  // 現在のページ状態を確認
  await checkCurrentPage();

  // 分析ボタン
  document.getElementById('analyze-btn').addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!isTargetSite(tab.url)) {
      alert('この拡張機能はZennとQiitaでのみ動作します');
      return;
    }

    // コンテンツスクリプトを再注入して実行
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        // 既存のバナーを削除して再分析
        const banner = document.getElementById('ai-article-warning-banner');
        if (banner) banner.remove();
        window.aiArticleWarningInjected = false;
        
        // content.jsを再実行
        if (typeof analyzeArticle === 'function') {
          analyzeArticle();
        } else {
          location.reload();
        }
      }
    });

    setTimeout(checkCurrentPage, 500);
  });
});

function isTargetSite(url) {
  return url && (url.includes('zenn.dev') || url.includes('qiita.com'));
}

async function checkCurrentPage() {
  const statusBox = document.getElementById('current-page-status');
  const statusHelp = document.getElementById('status-help');
  const analyzeBtn = document.getElementById('analyze-btn');
  
  try {
    // scripting APIが利用可能かチェック
    if (!chrome.scripting) {
      statusBox.className = 'status-box status-info';
      statusBox.innerHTML = '⚠️ 拡張機能を再読み込みしてください';
      if (statusHelp) statusHelp.textContent = '設定が変更されました。chrome://extensions/ で拡張機能を一度無効にしてから再度有効にしてください。';
      if (analyzeBtn) analyzeBtn.disabled = true;
      return;
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab || !tab.url || !isTargetSite(tab.url)) {
      statusBox.className = 'status-box status-info';
      statusBox.innerHTML = '💤 ZennまたはQiitaの記事ページで動作します';
      if (statusHelp) statusHelp.textContent = '記事ページを開くと自動で分析されます';
      if (analyzeBtn) analyzeBtn.disabled = true;
      return;
    }

    // バナーの存在をチェック
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const banner = document.getElementById('ai-article-warning-banner');
        if (!banner) return { found: false };
        
        const isHigh = banner.classList.contains('ai-warning-high');
        const isMedium = banner.classList.contains('ai-warning-medium');
        
        // スコアを取得
        const text = banner.querySelector('.ai-warning-text');
        const scoreMatch = text?.textContent.match(/スコア:\s*(\d+)/);
        const score = scoreMatch ? parseInt(scoreMatch[1]) : null;
        
        return { 
          found: true, 
          isHigh, 
          isMedium,
          score
        };
      }
    });

    const result = results[0]?.result;
    
    if (!result?.found) {
      statusBox.className = 'status-box status-safe';
      statusBox.innerHTML = '✅ AI記事の警告は表示されていません';
      if (statusHelp) statusHelp.textContent = '記事を分析しましたが、AIっぽい表現は検出されませんでした';
    } else if (result.isHigh) {
      statusBox.className = 'status-box status-danger';
      statusBox.innerHTML = `🤖 AI記事の可能性が高いです${result.score ? ` (スコア: ${result.score})` : ''}`;
      if (statusHelp) statusHelp.textContent = 'この記事には多くのAIっぽい表現が含まれています';
    } else if (result.isMedium) {
      statusBox.className = 'status-box status-warning';
      statusBox.innerHTML = `⚡ AIっぽい表現が検出されました${result.score ? ` (スコア: ${result.score})` : ''}`;
      if (statusHelp) statusHelp.textContent = 'この記事には一部AIっぽい表現が含まれています';
    } else {
      statusBox.className = 'status-box status-safe';
      statusBox.innerHTML = '✅ 問題なさそうです';
      if (statusHelp) statusHelp.textContent = 'この記事にAIっぽい表現は見つかりませんでした';
    }

  } catch (error) {
    statusBox.className = 'status-box status-info';
    statusBox.innerHTML = '💡 このページでは分析できません';
    if (statusHelp) statusHelp.textContent = 'ZennまたはQiitaの記事ページを開いている場合は、ページが完全に読み込まれるまで少し待ってから「今のページを分析」ボタンを押してください。';
    console.error(error);
  }
}
