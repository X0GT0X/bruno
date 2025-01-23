import React, { useEffect, useState } from 'react';
import { isElectron } from 'utils/common/platform';
import Modal from 'components/Modal';
import StyledWrapper from 'components/Prompt/StyledWrapper';

const Prompt = () => {
  if (typeof window == 'undefined') {
    return <div></div>;
  }

  const { ipcRenderer } = window;
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [promptVars, setPromptVars] = useState({});
  const [variables, setVariables] = useState({});

  useEffect(() => {
    if (!isElectron()) {
      return;
    }

    const clearListener = ipcRenderer.on('main:prompt-variable', (args) => {
      setVariables(args.variables);
      setPromptVars(args.promptVars);
      setShowPromptModal(true);
    });

    return () => {
      clearListener();
    };
  }, [isElectron, ipcRenderer, setShowPromptModal, setVariables, setPromptVars]);

  if (!showPromptModal) {
    return <div></div>;
  }

  const onClose = () => {
    ipcRenderer.invoke('main:prompt-variable-return', variables);
    setShowPromptModal(false);
  }

  const onCancel = () => {
    ipcRenderer.invoke('main:prompt-variable-return', {});
    setShowPromptModal(false);
  }

  const changeValue = (key, value) => {
    setVariables({ ...variables, [key]: value });
  }

  return (
    <StyledWrapper>
      <Modal
        size="md"
        title="Variables"
        confirmText="OK"
        handleCancel={onCancel}
        disableEscapeKey={true}
        disableCloseOnOutsideClick={true}
        closeModalFadeTimeout={150}
        hideFooter={true}
      >
        <table>
          <thead>
          <tr>
            <td>Name</td>
            <td>Value</td>
          </tr>
          </thead>
          <tbody>
          {promptVars.map((promptVar) => (
            <tr>
              <td>{promptVar.label}</td>
              <td>
                <input
                  type="text"
                  className="block textbox mt-2 w-full"
                  onChange={(event) => changeValue(promptVar.key, event.target.value)}
                  value={variables[promptVar.key]}
                ></input>
              </td>
            </tr>
          ))}
          </tbody>
        </table>

        <button className="btn btn-secondary btn-md mt-4" onClick={onClose}>
          OK
        </button>
      </Modal>
    </StyledWrapper>
  );
};

export default Prompt;
