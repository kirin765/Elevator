using System;
using System.Linq;
using UnityEngine;
using UnityEngine.InputSystem;

namespace Elevator.Inputs
{
    public sealed class ElevatorInputRouter : MonoBehaviour
    {
        [SerializeField]
        private InputActionAsset inputActionAsset;

        [SerializeField]
        private string gameActionMapName = "Game";

        [SerializeField]
        private string fallbackActionMapName = "Game";

        private InputAction holdAction;
        private InputAction anyTapAction;

        public event Action HoldStarted;
        public event Action HoldEnded;
        public event Action Tapped;

        public bool IsHolding { get; private set; }

        private void Awake()
        {
            SetupActions();
            if (holdAction != null)
            {
                holdAction.started += OnHoldStarted;
                holdAction.canceled += OnHoldCanceled;
            }

            if (anyTapAction != null)
            {
                anyTapAction.performed += OnAnyTap;
            }
        }

        private void OnEnable()
        {
            holdAction?.Enable();
            anyTapAction?.Enable();
        }

        private void OnDisable()
        {
            holdAction?.Disable();
            anyTapAction?.Disable();
        }

        private void OnDestroy()
        {
            if (holdAction != null)
            {
                holdAction.started -= OnHoldStarted;
                holdAction.canceled -= OnHoldCanceled;
                holdAction.Dispose();
            }

            if (anyTapAction != null)
            {
                anyTapAction.performed -= OnAnyTap;
                anyTapAction.Dispose();
            }
        }

        private void SetupActions()
        {
            if (inputActionAsset != null)
            {
                var map = inputActionAsset.FindActionMap(gameActionMapName, true);
                if (map == null)
                {
                    Debug.LogWarning(
                        $"[ElevatorInputRouter] Action map '{gameActionMapName}' was not found in assigned asset. Falling back to generated map.");
                    map = inputActionAsset.FindActionMap("Game", true);
                }

                if (map == null)
                {
                    CreateFallbackActions();
                    return;
                }

                holdAction = map.FindAction("Hold");
                anyTapAction = map.FindAction("AnyTap");

                if (holdAction == null)
                {
                    holdAction = map.AddAction("Hold", InputActionType.Button);
                }

                if (anyTapAction == null)
                {
                    anyTapAction = map.AddAction("AnyTap", InputActionType.Button);
                }

                BindActionWithDefaults(holdAction, "<Touchscreen>/primaryTouch/press");
                BindActionWithDefaults(holdAction, "<Mouse>/leftButton");
                BindActionWithDefaults(holdAction, "<Keyboard>/space");

                BindActionWithDefaults(anyTapAction, "<Touchscreen>/primaryTouch/press");
                BindActionWithDefaults(anyTapAction, "<Mouse>/leftButton");
                BindActionWithDefaults(anyTapAction, "<Keyboard>/space");

                holdAction?.Enable();
                anyTapAction?.Enable();
                return;
            }

            CreateFallbackActions();
        }

        private void CreateFallbackActions()
        {
            var gameMap = new InputActionMap(fallbackActionMapName);
            holdAction = gameMap.AddAction("Hold", InputActionType.Button);
            BindActionWithDefaults(holdAction, "<Touchscreen>/primaryTouch/press");
            BindActionWithDefaults(holdAction, "<Mouse>/leftButton");
            BindActionWithDefaults(holdAction, "<Keyboard>/space");

            anyTapAction = gameMap.AddAction("AnyTap", InputActionType.Button);
            BindActionWithDefaults(anyTapAction, "<Touchscreen>/primaryTouch/press");
            BindActionWithDefaults(anyTapAction, "<Mouse>/leftButton");
            BindActionWithDefaults(anyTapAction, "<Keyboard>/space");

            gameMap.AddAction("UI_Navigate", InputActionType.Button)
                .AddBinding("<Gamepad>/leftStick/up");
            gameMap.AddAction("UI_Submit", InputActionType.Button)
                .AddBinding("<Keyboard>/space");

            gameMap.Enable();
        }

        private static void BindActionWithDefaults(InputAction action, string path)
        {
            if (action == null || string.IsNullOrWhiteSpace(path))
            {
                return;
            }

            if (action.bindings.Any(b => b.path == path))
            {
                return;
            }

            action.AddBinding(path);
        }

        private void OnHoldStarted(InputAction.CallbackContext context)
        {
            IsHolding = true;
            HoldStarted?.Invoke();
        }

        private void OnHoldCanceled(InputAction.CallbackContext context)
        {
            IsHolding = false;
            HoldEnded?.Invoke();
        }

        private void OnAnyTap(InputAction.CallbackContext context)
        {
            if (context.performed)
            {
                Tapped?.Invoke();
            }
        }
    }
}
