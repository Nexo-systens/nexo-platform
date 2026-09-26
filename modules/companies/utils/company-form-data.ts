/**
 * Mission 201 — Founding Company Final Go-Live Gate.
 *
 * `CompanyFormSheet` sempre envia todos os campos; um select opcional
 * não escolhido (Regime tributário, Porte) chega como "". O schema
 * compartilhado com o cliente (`companyFormSchema`) aceita esses campos
 * como `undefined`, não "" — antes, a criação/edição de empresa falhava
 * no servidor com `fieldErrors` que o formulário não exibe: o botão
 * simplesmente não fazia nada. Normalizado aqui, na borda da Server
 * Action, sem mudar o tipo de entrada do formulário.
 */
const OPTIONAL_SELECT_FIELDS = ["regimeTributario", "porte"] as const;

export function companyFormDataToInput(formData: FormData): Record<string, FormDataEntryValue> {
  const input = Object.fromEntries(formData);
  for (const field of OPTIONAL_SELECT_FIELDS) {
    if (input[field] === "") delete input[field];
  }
  return input;
}
