function getCurrentFormattedTime() {
  const currentTime = new Date();
  const year = currentTime.getFullYear();
  const month = String(currentTime.getMonth() + 1).padStart(2, '0'); // 월을 2자리로 표현
  const day = String(currentTime.getDate()).padStart(2, '0'); // 일을 2자리로 표현
  const hours = String(currentTime.getHours()).padStart(2, '0'); // 시를 2자리로 표현
  const minutes = String(currentTime.getMinutes()).padStart(2, '0'); // 분을 2자리로 표현
  const seconds = String(currentTime.getSeconds()).padStart(2, '0'); // 초를 2자리로 표현

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}


export function Log(msg) {
  let data = getCurrentFormattedTime()
  console.log(`${data}, ${msg}`)
}

export function Debug(msg, isDebug) {
  if (isDebug) {
    console.log(msg)
  }
}

