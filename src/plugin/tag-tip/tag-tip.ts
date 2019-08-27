import { fromEvent } from 'rxjs';
import { filter, map } from 'rxjs/operators';

import { namespaceTranslate } from '../../data/namespace-translate';
import { SearchTagItem } from '../../interface';
import { config } from '../../tool/config-manage';
import { logger } from '../../tool/log';
import { getTagData } from '../../tool/tag-data';

import './tag-tip.less';

const { tagList } = getTagData();

class TagTip {
    selectedIndex = 0;
    readonly inputElement: HTMLInputElement;
    readonly autoCompleteList: HTMLDivElement;
    delimiter = ' ';

    constructor(inputElement: HTMLInputElement, delimiter = ' ') {
        this.delimiter = delimiter;
        this.inputElement = inputElement;
        this.inputElement.autocomplete = 'off';
        this.autoCompleteList = document.createElement('div');
        this.autoCompleteList.className = 'eh-syringe-lite-auto-complete-list';

        fromEvent(this.inputElement, 'keyup').pipe(
            filter((e: KeyboardEvent) => !new Set(['ArrowUp', 'ArrowDown', 'Enter']).has(e.code)),
            map(() => this.inputElement.value),
            // distinctUntilChanged()
        ).subscribe(this.search.bind(this));

        fromEvent(this.inputElement, 'keydown').subscribe(this.keydown.bind(this));

        fromEvent(this.autoCompleteList, 'click').subscribe(e => {
            this.inputElement.focus();
            e.preventDefault();
            e.stopPropagation();
        });

        fromEvent(this.inputElement, 'focus').subscribe(this.setListPosition.bind(this));

        fromEvent(window, 'resize').subscribe(this.setListPosition.bind(this));
        fromEvent(window, 'onscroll').subscribe(this.setListPosition.bind(this));

        fromEvent(document, 'click').subscribe(() => {
            this.autoCompleteList.innerHTML = '';
        });

        document.body.insertBefore(this.autoCompleteList, null);
    }

    search(value: string) {
        // todo: 增加自定义分隔符
        value = this.inputElement.value = value.replace(/  +/mg, ' ');
        const values = value.match(/(\S+:".+?"|".+?"|\S+:\S+|\S+)/igm) || [];
        const result: SearchTagItem[] = [];
        const used = new Set();
        values.forEach((v, i) => {
            const sv = values.slice(i);
            if (sv.length) {
                const svs = sv.join(' ').toLowerCase();
                if (!svs || svs.replace(/\s+/, '').length === 0) return;

                tagList.filter(v => v.search.indexOf(svs) !== -1 || v.name.indexOf(svs) !== -1)
                    .forEach(tag => {
                        if (used.has(tag.search)) return;
                        used.add(tag.search);
                        result.push({
                            ...tag,
                            input: svs,
                        });
                    });
                if (result.length >= 50) {
                    result;
                }
            }
        });
        this.autoCompleteList.innerHTML = '';
        result.slice(0, 50).forEach(tag => {
            this.autoCompleteList.insertBefore(this.tagElementItem(tag), null);
        });
        this.selectedIndex = -1;
    }

    keydown(e: KeyboardEvent) {
        if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
            if (e.code === 'ArrowUp') {
                this.selectedIndex--;
                if (this.selectedIndex < 0) {
                    this.selectedIndex = this.autoCompleteList.children.length - 1;
                }
            } else {
                this.selectedIndex++;
                if (this.selectedIndex >= this.autoCompleteList.children.length) {
                    this.selectedIndex = 0;
                }
            }

            const children = Array.from(this.autoCompleteList.children);
            children.forEach(element => {
                element.classList.remove('selected');
            });
            if (this.selectedIndex >= 0 && children[this.selectedIndex]) {
                children[this.selectedIndex].classList.add('selected');
            }
            e.preventDefault();
            e.stopPropagation();
        } else if (e.code === 'Enter') {
            const children = Array.from(this.autoCompleteList.children);
            if (this.selectedIndex >= 0 && children[this.selectedIndex]) {
                (children[this.selectedIndex] as any).click();
                e.preventDefault();
                e.stopPropagation();
            }
        }
    }

    setListPosition() {
        const rect = this.inputElement.getBoundingClientRect();
        this.autoCompleteList.style.left = `${rect.left}px`;
        this.autoCompleteList.style.top = `${rect.bottom}px`;
        this.autoCompleteList.style.minWidth = `${rect.width}px`;
    }

    tagElementItem(tag: SearchTagItem): HTMLDivElement {
        const item = document.createElement('div');
        const cnName = document.createElement('span');
        cnName.className = 'auto-complete-text cn-name';
        const enName = document.createElement('span');
        enName.className = 'auto-complete-text en-name';
        const cnNamespace = namespaceTranslate[tag.namespace];
        let cnNameHtml = '';
        let enNameHtml = tag.search;
        if (tag.namespace !== 'misc') {
            cnNameHtml += cnNamespace + ':';
        }
        cnNameHtml += tag.name;

        logger.log(tag.input);

        cnNameHtml = cnNameHtml.replace(tag.input, `<mark>${tag.input}</mark>`);
        enNameHtml = enNameHtml.replace(tag.input, `<mark>${tag.input}</mark>`);

        cnName.innerHTML = cnNameHtml;
        enName.innerHTML = enNameHtml;

        item.insertBefore(cnName, null);
        item.insertBefore(enName, null);

        item.className = 'auto-complete-item';

        item.onclick = () => {
            let length = tag.input.length;
            if (this.inputElement.value.slice(-1) === ' ') {
                length++;
            }
            this.inputElement.value = this.inputElement.value.slice(0, 0 - length) + tag.search + ' ';
            this.autoCompleteList.innerHTML = '';
        };
        return item;
    }
}

export const tagTipInit = async () => {
    const conf = await config.get();
    if (!conf.tagTip) return;
    logger.log('标签提示');

    const searchInput: HTMLInputElement = document.querySelector('#f_search');
    if (!searchInput) return;
    return new TagTip(searchInput);
};
