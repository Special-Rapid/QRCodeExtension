import type { LocalePreference, ResolvedLocale } from './preferences';

export type StringKey =
  | 'appName'
  | 'system'
  | 'light'
  | 'dark'
  | 'language'
  | 'appearance'
  | 'scannerTitle'
  | 'scanOpen'
  | 'pcLinkSettings'
  | 'cameraPreparing'
  | 'cameraAccessRequired'
  | 'cameraPurpose'
  | 'cameraSettingsHint'
  | 'openSettings'
  | 'allowCamera'
  | 'pcStateChecking'
  | 'pcStateAutoSend'
  | 'pcStateConnect'
  | 'pcAutoSend'
  | 'pcNeedLink'
  | 'pcSending'
  | 'pcWaiting'
  | 'pcSent'
  | 'pcExpired'
  | 'pcFailed'
  | 'pcLinkForAutoSend'
  | 'candidateChecking'
  | 'candidatePickNotice'
  | 'candidateRetake'
  | 'candidatePrevious'
  | 'candidateNext'
  | 'candidateOpen'
  | 'candidateCopy'
  | 'candidateSendPc'
  | 'candidateKindBarcode'
  | 'candidateKindOcr'
  | 'candidateKindRead'
  | 'candidatePromptQr'
  | 'candidatePromptText'
  | 'candidatePromptReady'
  | 'deliveriesConfirmed'
  | 'deliveriesConfirming'
  | 'deliveriesExpired'
  | 'deliveriesFailed'
  | 'deliveryPrompt'
  | 'deliveryContinue'
  | 'deliveryNoLink'
  | 'deliveryCopied'
  | 'deliveryToPc'
  | 'pairTitle'
  | 'pairBody'
  | 'thisPhone'
  | 'connectedPcs'
  | 'notConnected'
  | 'pairCodeLabel'
  | 'pairCodePlaceholder'
  | 'confirmCode'
  | 'confirmPhrase'
  | 'confirmThisPhone'
  | 'pairingMessage'
  | 'pairingInputStatus'
  | 'pairingRetry'
  | 'pairingBack'
  | 'pairRemove'
  | 'pairRemoving'
  | 'pairRemoveLabel'
  | 'themeSystem'
  | 'themeLight'
  | 'themeDark'
  | 'localeSystem'
  | 'localeJapanese'
  | 'localeEnglish'
  | 'currentDevice'
  | 'pairDefaultMessage'
  | 'pairRemoteRevoked'
  | 'pairCodeExpired'
  | 'pairComplete'
  | 'pairAwaitingPc'
  | 'pairClaimError'
  | 'pairConfirmError'
  | 'pairRemoveError'
  | 'pairAddPc'
  | 'pairedOn'
  | 'scannerResuming'
  | 'torchOn'
  | 'torchOff'
  | 'zoomTo'
  | 'candidateSelect'
  | 'pairPc'
  | 'receiptConfirmed'
  | 'receiptExpired'
  | 'receiptWaiting'
  | 'sendFailed' | 'handoffNetworkError' | 'handoffExpiredError' | 'handoffClaimedError' | 'handoffUnauthorizedError' | 'handoffNotPairedError' | 'handoffDeliveryError' | 'handoffGenericError' | 'settingsTitle' | 'settingsBody' | 'settingsOpen';

const messages: Record<ResolvedLocale, Record<StringKey, string>> = {
  ja: {
    appName: 'QR Scan',
    system: 'システム',
    light: 'ライト',
    dark: 'ダーク',
    language: '言語',
    appearance: '外観',
    scannerTitle: 'スキャナー',
    scanOpen: 'スキャンを開く',
    pcLinkSettings: 'PC連携',
    cameraPreparing: 'カメラを準備しています…',
    cameraAccessRequired: 'カメラへのアクセスが必要です',
    cameraPurpose: 'QRコード・バーコード・印刷URLをこの端末内で読み取るためにだけ使用します。画像は送信しません。',
    cameraSettingsHint: 'カメラを許可するには、端末の設定でこのアプリのカメラアクセスをオンにしてください。',
    openSettings: '設定を開く',
    allowCamera: 'カメラを許可',
    pcStateChecking: 'PC連携の状態を確認しています…',
    pcStateAutoSend: 'PCに自動送信',
    pcStateConnect: 'PCと連携して使う',
    pcAutoSend: 'PCへ自動送信',
    pcNeedLink: 'PC未連携',
    pcSending: 'PCへ送信中…',
    pcWaiting: 'PCの受領を確認中…',
    pcSent: 'PCへ送信済み',
    pcExpired: 'PCの受領を確認できませんでした',
    pcFailed: '送信できませんでした',
    pcLinkForAutoSend: 'PC連携で自動送信',
    candidateChecking: '候補を確認しています…',
    candidatePickNotice: '候補を選んでからPCへ届けます。',
    candidateRetake: '撮り直す',
    candidatePrevious: '前へ',
    candidateNext: '次へ',
    candidateOpen: '開く',
    candidateCopy: 'コピー',
    candidateSendPc: 'PCに届ける',
    candidateKindBarcode: '読み取り候補',
    candidateKindOcr: '文字リンク候補',
    candidateKindRead: '読み取り候補',
    candidatePromptQr: 'QRコード・印刷URLを枠に合わせてください',
    candidatePromptText: '印刷URLを枠に合わせてください',
    candidatePromptReady: 'QRコードを枠に合わせてください',
    deliveriesConfirmed: '台のPCが受領を確認しました。',
    deliveriesConfirming: '台のPCが受領を確認中です。',
    deliveriesExpired: '台のPCが受領を確認しました。未確認の送信先は期限切れです。',
    deliveriesFailed: 'PCの受領状態を再確認しています…',
    deliveryPrompt: 'この結果をPCへ送ります。続けてで取り消せます。',
    deliveryContinue: '続けて',
    deliveryNoLink: 'PC連携で自動送信',
    deliveryCopied: 'コピーしました。',
    deliveryToPc: 'PCへ送信しています…',
    pairTitle: 'PCと連携',
    pairBody: 'PCで qr.snkisk.com を開き、「スマホと連携」から表示されるコードを入力します。新しいPCを追加するたび、両方の画面で確認します。',
    thisPhone: 'このスマホ',
    connectedPcs: '接続中のPC',
    notConnected: 'まだPCは接続されていません。',
    pairCodeLabel: '8文字の連携コード',
    pairCodePlaceholder: 'AB2C-DE3F',
    confirmCode: 'コードを確認',
    confirmPhrase: '確認フレーズ',
    confirmThisPhone: 'このスマホで確認する',
    pairingMessage: 'PCにも同じ確認フレーズが表示されます。見比べてください。',
    pairingInputStatus: '接続情報を確認できませんでした。アプリを開き直してから、もう一度試してください。',
    pairingRetry: '確認中…',
    pairingBack: 'スキャン画面へ戻る',
    pairRemove: '解除',
    pairRemoving: '解除中…',
    pairRemoveLabel: 'との連携を解除',
    themeSystem: 'システム',
    themeLight: 'ライト',
    themeDark: 'ダーク',
    localeSystem: 'システム',
    localeJapanese: '日本語',
    localeEnglish: 'English',
    currentDevice: '現在の端末',
    pairDefaultMessage: 'PCで表示した8文字の連携コードを入力してください。PCは何台でも追加できます。',
    pairRemoteRevoked: 'PC側で連携が解除されました。',
    pairCodeExpired: '連携コードの有効期限が切れました。',
    pairComplete: 'PCとの連携が完了しました。ほかのPCも追加できます。',
    pairAwaitingPc: 'PC側の確認を待っています。',
    pairClaimError: '連携コードを確認できませんでした。',
    pairConfirmError: '確認を完了できませんでした。',
    pairRemoveError: '連携を解除できませんでした。',
    pairAddPc: 'PCを追加する',
    pairedOn: '連携',
    scannerResuming: 'カメラを再開しています…',
    torchOn: 'ライトをオフ',
    torchOff: 'ライトをオン',
    zoomTo: 'にズーム',
    candidateSelect: '候補を選ぶ',
    pairPc: 'PC連携',
    receiptConfirmed: '{{acknowledged}}台のPCが受領を確認しました。',
    receiptExpired: '{{acknowledged}} / {{total}}台のPCが受領を確認しました。未確認の送信先は期限切れです。',
    receiptWaiting: '{{acknowledged}} / {{total}}台のPCが受領を確認中です。',
    sendFailed: 'PCへ送信できませんでした。',
    handoffNetworkError: 'PC連携サービスへ接続できません。ネットワークと設定を確認してください。',
    handoffExpiredError: '連携コードの有効期限が切れました。PCで新しいコードを表示してください。',
    handoffClaimedError: 'このコードは別のスマホで入力済みです。',
    handoffUnauthorizedError: '連携情報を確認できませんでした。もう一度連携してください。',
    handoffNotPairedError: '先にPCと連携してください。',
    handoffDeliveryError: 'PCへの送信を完了できませんでした。もう一度試してください。',
    handoffGenericError: 'PC連携を完了できませんでした。',
    settingsTitle: '設定',
    settingsBody: '表示と言語の設定はこの端末だけに保存されます。',
    settingsOpen: '設定',
  },
  en: {
    appName: 'QR Scan',
    system: 'System',
    light: 'Light',
    dark: 'Dark',
    language: 'Language',
    appearance: 'Appearance',
    scannerTitle: 'Scanner',
    scanOpen: 'Open Scan',
    pcLinkSettings: 'PC link',
    cameraPreparing: 'Preparing the camera…',
    cameraAccessRequired: 'Camera access is required',
    cameraPurpose: 'Used only to read QR codes, barcodes, and printed URLs on this device. Images are not sent.',
    cameraSettingsHint: 'To allow the camera, turn on this app’s camera access in device settings.',
    openSettings: 'Open Settings',
    allowCamera: 'Allow Camera',
    pcStateChecking: 'Checking PC link status…',
    pcStateAutoSend: 'Auto-send to PC',
    pcStateConnect: 'Use with PC link',
    pcAutoSend: 'Auto-sending to PC',
    pcNeedLink: 'No PC link yet',
    pcSending: 'Sending to PC…',
    pcWaiting: 'Waiting for PC receipt…',
    pcSent: 'Sent to PC',
    pcExpired: 'Could not confirm PC receipt',
    pcFailed: 'Could not send',
    pcLinkForAutoSend: 'PC link for auto-send',
    candidateChecking: 'Checking candidates…',
    candidatePickNotice: 'Pick a candidate before sending it to the PC.',
    candidateRetake: 'Retake',
    candidatePrevious: 'Previous',
    candidateNext: 'Next',
    candidateOpen: 'Open',
    candidateCopy: 'Copy',
    candidateSendPc: 'Send to PC',
    candidateKindBarcode: 'Scan result',
    candidateKindOcr: 'Text link candidate',
    candidateKindRead: 'Scan result',
    candidatePromptQr: 'Fit the QR code or printed URL in frame',
    candidatePromptText: 'Fit the printed URL in frame',
    candidatePromptReady: 'Fit the QR code in frame',
    deliveriesConfirmed: 'PCs confirmed receipt.',
    deliveriesConfirming: 'of PCs are confirming receipt.',
    deliveriesExpired: 'PCs confirmed receipt. Remaining destinations expired.',
    deliveriesFailed: 'Rechecking PC receipt status…',
    deliveryPrompt: 'This result will be sent to the PC. Continue to cancel.',
    deliveryContinue: 'Continue',
    deliveryNoLink: 'PC link for auto-send',
    deliveryCopied: 'Copied.',
    deliveryToPc: 'Sending to PC…',
    pairTitle: 'Link with PC',
    pairBody: 'Open qr.snkisk.com on the PC and enter the code shown from “Link phone”. Each new PC must be confirmed on both screens.',
    thisPhone: 'This phone',
    connectedPcs: 'Connected PCs',
    notConnected: 'No PCs are connected yet.',
    pairCodeLabel: '8-character link code',
    pairCodePlaceholder: 'AB2C-DE3F',
    confirmCode: 'Check code',
    confirmPhrase: 'Confirmation phrase',
    confirmThisPhone: 'Confirm on this phone',
    pairingMessage: 'The same confirmation phrase appears on the PC. Compare both screens.',
    pairingInputStatus: 'Could not check connection info. Reopen the app and try again.',
    pairingRetry: 'Checking…',
    pairingBack: 'Back to scanner',
    pairRemove: 'Remove',
    pairRemoving: 'Removing…',
    pairRemoveLabel: ' unlink',
    themeSystem: 'System',
    themeLight: 'Light',
    themeDark: 'Dark',
    localeSystem: 'System',
    localeJapanese: 'Japanese',
    localeEnglish: 'English',
    currentDevice: 'Current device',
    pairDefaultMessage: 'Enter the 8-character link code shown on the PC. You can add any number of PCs.',
    pairRemoteRevoked: 'The PC removed this link.',
    pairCodeExpired: 'The link code expired.',
    pairComplete: 'Linked with the PC. You can add another PC.',
    pairAwaitingPc: 'Waiting for confirmation on the PC.',
    pairClaimError: 'Could not check the link code.',
    pairConfirmError: 'Could not complete confirmation.',
    pairRemoveError: 'Could not remove the link.',
    pairAddPc: 'Add a PC',
    pairedOn: 'Linked',
    scannerResuming: 'Resuming the camera…',
    torchOn: 'Turn flashlight off',
    torchOff: 'Turn flashlight on',
    zoomTo: ' zoom',
    candidateSelect: 'Select candidate',
    pairPc: 'Link PC',
    receiptConfirmed: '{{acknowledged}} PC(s) confirmed receipt.',
    receiptExpired: '{{acknowledged}} / {{total}} PC(s) confirmed receipt. Remaining destinations expired.',
    receiptWaiting: 'Waiting for receipt: {{acknowledged}} / {{total}} PC(s).',
    sendFailed: 'Could not send to the PC.',
    handoffNetworkError: 'Could not connect to the PC link service. Check your network and settings.',
    handoffExpiredError: 'The link code expired. Show a new code on the PC.',
    handoffClaimedError: 'Another phone has already entered this code.',
    handoffUnauthorizedError: 'Could not verify the link. Link the PC again.',
    handoffNotPairedError: 'Link a PC first.',
    handoffDeliveryError: 'Could not complete delivery to the PC. Try again.',
    handoffGenericError: 'Could not complete PC linking.',
    settingsTitle: 'Settings',
    settingsBody: 'Appearance and language choices are saved only on this device.',
    settingsOpen: 'Settings',
  },
};

export function getStrings(locale: ResolvedLocale) {
  return messages[locale];
}

export function formatString(template: string, values: Record<string, string | number>) {
  return template.replace(/{{(\w+)}}/g, (_, key: string) => String(values[key] ?? ''));
}

export function handoffErrorMessage(messages: Record<StringKey, string>, error: unknown) {
  const code = error instanceof Error ? (error as Error & { code?: string }).code : undefined;
  const key = ({
    network: 'handoffNetworkError',
    expired: 'handoffExpiredError',
    already_claimed: 'handoffClaimedError',
    unauthorized: 'handoffUnauthorizedError',
    not_paired: 'handoffNotPairedError',
    delivery_failed: 'handoffDeliveryError',
  } as Record<string, StringKey>)[code ?? ''] ?? 'handoffGenericError';
  return messages[key];
}

export function resolvePreferenceLocale(value: LocalePreference, systemLocale: ResolvedLocale) {
  return value === 'system' ? systemLocale : value;
}
