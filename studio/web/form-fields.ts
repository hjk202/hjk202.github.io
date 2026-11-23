/** Small DOM controls shared by actual module forms; they do not own content or validation. */
export function stringArray(container: HTMLElement, values: string[], label: string, changed: () => void) {
  const render = () => {
    container.replaceChildren();
    values.forEach((value, index) => {
      const row = document.createElement('label'), input = document.createElement('textarea'), remove = document.createElement('button');
      row.textContent = `${label} ${index + 1}`; input.value = value;
      input.setAttribute('aria-label', `${label} ${index + 1}`);
      input.addEventListener('input', () => { values[index] = input.value; changed(); });
      remove.type = 'button'; remove.textContent = `删除${label} ${index + 1}`;
      remove.addEventListener('click', () => { values.splice(index, 1); changed(); render(); });
      row.append(input, remove); container.append(row);
    });
    const add = document.createElement('button'); add.type = 'button'; add.textContent = `添加${label}`;
    add.addEventListener('click', () => { values.push(''); changed(); render(); }); container.append(add);
  }; render();
}
export function linkArray(container: HTMLElement, values: { label: string; url: string }[], changed: () => void) {
  const render = () => {
    container.replaceChildren();
    values.forEach((value, index) => {
      const row = document.createElement('div');
      for (const field of ['label', 'url'] as const) {
        const label = document.createElement('label'), input = document.createElement('input');
        label.textContent = `${field === 'label' ? '链接名称' : '链接地址'} ${index + 1}`; input.value = value[field] ?? '';
        input.addEventListener('input', () => { value[field] = input.value; changed(); }); label.append(input); row.append(label);
      }
      const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = `删除链接 ${index + 1}`;
      remove.addEventListener('click', () => { values.splice(index, 1); changed(); render(); }); row.append(remove); container.append(row);
    });
    const add = document.createElement('button'); add.type = 'button'; add.textContent = '添加链接';
    add.addEventListener('click', () => { values.push({ label: '', url: '' }); changed(); render(); }); container.append(add);
  }; render();
}

export function textField(container: HTMLElement, label: string, value: string, changed: (value: string) => void, multiline = false) {
  const row = document.createElement('label'), input = document.createElement(multiline ? 'textarea' : 'input');
  row.textContent = label; input.value = value ?? ''; input.addEventListener('input', () => changed(input.value)); row.append(input); container.append(row);
}
export function selectField(container: HTMLElement, label: string, value: string, options: readonly (readonly [string, string])[], changed: (value: string) => void) {
  const row = document.createElement('label'), select = document.createElement('select'); row.textContent = label;
  select.setAttribute('aria-label', label);
  for (const [value, text] of options) { const option = document.createElement('option'); option.value = value; option.textContent = text; select.append(option); }
  if(!options.some(([key])=>key===value)){const missing=document.createElement('option');missing.value='';missing.textContent='待确认';select.prepend(missing);}
  select.value = value ?? ''; select.addEventListener('input', () => changed(select.value)); row.append(select); container.append(row);
}
export function recordArray<T>(container: HTMLElement, values: T[], label: string, blank: () => T, fields: (container: HTMLElement, value: T) => void, changed: () => void) {
  const render = () => {
    container.replaceChildren();
    values.forEach((value, index) => {
      const group = document.createElement('fieldset'), legend = document.createElement('legend'), remove = document.createElement('button');
      legend.textContent = `${label} ${index + 1}`; group.append(legend); fields(group, value);
      remove.type = 'button'; remove.textContent = `删除${label} ${index + 1}`;
      remove.addEventListener('click', () => { values.splice(index, 1); changed(); render(); }); group.append(remove); container.append(group);
    });
    const add = document.createElement('button'); add.type = 'button'; add.textContent = `添加${label}`;
    add.addEventListener('click', () => { values.push(blank()); changed(); render(); }); container.append(add);
  }; render();
}
