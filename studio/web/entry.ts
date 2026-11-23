import './styles.css';
import './writing.css';
import { startMaintenance } from './main.ts';
import { startThinkWriting } from './think-writing.ts';

const template = document.querySelector<HTMLTemplateElement>('#maintenance-view')!;
if (['#think', '#maintenance', '#maintenance-build', '#maintenance-keep', '#maintenance-me'].includes(location.hash)) {
  template.replaceWith(template.content);
  startMaintenance();
} else {
  template.remove();
  startThinkWriting();
}
