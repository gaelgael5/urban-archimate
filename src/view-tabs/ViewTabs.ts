import type { ModelView } from '../contract/types.ts';

export interface ViewTabsOptions {
  container: HTMLElement;

  onSelect: (vueId: string) => void;
  onAdd: (nom: string, pointDeVue?: string) => void;
  onRename: (vueId: string, nom: string) => void;
  onDelete: (vueId: string) => void;
}

/**
 * The tab bar of the model views: switch, add (name + optional
 * ArchiMate viewpoint), rename (double click), delete (two-step
 * confirmation). The viewpoint of each view is displayed; what a
 * viewpoint allows is the host's business.
 */
export class ViewTabs {

  private _options: ViewTabsOptions;
  private _bar: HTMLElement;
  private _vues: ModelView[] = [];
  private _currentId: string | null = null;

  constructor(options: ViewTabsOptions) {
    this._options = options;

    this._bar = document.createElement('div');
    this._bar.className = 'ua-vues';
    options.container.appendChild(this._bar);

    this._render();
  }

  update(vues: ModelView[], currentId: string | null): void {
    this._vues = vues || [];
    this._currentId = currentId;
    this._render();
  }

  destroy(): void {
    this._bar.remove();
  }

  private _render(): void {
    this._bar.innerHTML = '';

    for (const vue of this._vues) {
      this._bar.appendChild(this._renderTab(vue));
    }

    this._bar.appendChild(this._renderAdd());
  }

  private _renderTab(vue: ModelView): HTMLElement {
    const tab = document.createElement('div');
    tab.className = 'ua-vue-onglet';
    tab.dataset.vueId = vue.id;

    if (vue.id === this._currentId) {
      tab.classList.add('ua-vue-active');
    }

    const label = document.createElement('span');
    label.className = 'ua-vue-nom';
    label.textContent = vue.nom || vue.id;
    tab.appendChild(label);

    if (vue.point_de_vue) {
      const viewpoint = document.createElement('span');
      viewpoint.className = 'ua-vue-point-de-vue';
      viewpoint.textContent = vue.point_de_vue;
      viewpoint.title = `Point de vue : ${ vue.point_de_vue }`;
      tab.appendChild(viewpoint);
    }

    label.addEventListener('click', () => this._options.onSelect(vue.id));

    // rename on double click
    label.addEventListener('dblclick', () => {
      const input = document.createElement('input');
      input.className = 'ua-vue-renommer';
      input.value = vue.nom || vue.id;

      const commit = () => {
        const nom = input.value.trim();
        if (nom && nom !== vue.nom) {
          this._options.onRename(vue.id, nom);
        } else {
          this._render();
        }
      };

      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          commit();
        } else if (event.key === 'Escape') {
          this._render();
        }
      });
      input.addEventListener('blur', commit);

      tab.replaceChild(input, label);
      input.focus();
      input.select();
    });

    // two-step delete confirmation (no native dialog)
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'ua-vue-supprimer';
    remove.title = 'Supprimer la vue';
    remove.textContent = '×';

    remove.addEventListener('click', () => {
      if (remove.dataset.confirm === '1') {
        this._options.onDelete(vue.id);
      } else {
        remove.dataset.confirm = '1';
        remove.textContent = 'Confirmer ?';
        remove.classList.add('ua-vue-supprimer-confirmation');

        setTimeout(() => {
          delete remove.dataset.confirm;
          remove.textContent = '×';
          remove.classList.remove('ua-vue-supprimer-confirmation');
        }, 3000);
      }
    });

    tab.appendChild(remove);

    return tab;
  }

  private _renderAdd(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'ua-vue-ajout';

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ua-vue-ajouter';
    button.title = 'Ajouter une vue';
    button.textContent = '+';

    button.addEventListener('click', () => {
      const form = document.createElement('form');
      form.className = 'ua-vue-ajout-formulaire';

      const nom = document.createElement('input');
      nom.placeholder = 'Nom de la vue';
      nom.name = 'nom';

      const pointDeVue = document.createElement('input');
      pointDeVue.placeholder = 'Point de vue (facultatif)';
      pointDeVue.name = 'point_de_vue';

      const ok = document.createElement('button');
      ok.type = 'submit';
      ok.textContent = 'Ajouter';

      form.appendChild(nom);
      form.appendChild(pointDeVue);
      form.appendChild(ok);

      form.addEventListener('submit', (event) => {
        event.preventDefault();

        if (nom.value.trim()) {
          this._options.onAdd(
            nom.value.trim(),
            pointDeVue.value.trim() || undefined);
        }
      });

      wrapper.replaceChild(form, button);
      nom.focus();
    });

    wrapper.appendChild(button);

    return wrapper;
  }
}
