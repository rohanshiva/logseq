(ns frontend.components.plugins
  (:require [rum.core :as rum]
            [frontend.state :as state]
            [cljs-bean.core :as bean]
            [frontend.ui :as ui]
            [frontend.util :as util]
            [electron.ipc :as ipc]
            [promesa.core :as p]
            [frontend.components.svg :as svg]
            [frontend.handler.notification :as notification]
            [frontend.handler.plugin :as plugin-handler]))

(rum/defc installed-themes
  < rum/reactive
  []
  (let [themes (state/sub :plugin/installed-themes)
        selected (state/sub :plugin/selected-theme)]
    [:div.cp__themes-installed
     [:h2.mb-4.text-xl "Installed Themes"]
     (for [opt themes]
       [:div.it.flex.px-3.py-3.mb-2.rounded-sm.justify-between
        {:key (:url opt)}
        [:section
         [:strong.block (:name opt)]
         [:small.opacity-30 (:description opt)]]
        (let [current-selected (= selected (:url opt))]
          [:a.text-blue-300.flex-shrink-0.flex.items-center.opacity-50
           {:on-click #(do (js/LSPluginCore.selectTheme (if current-selected nil (clj->js opt)))
                           (state/set-modal! nil))}
           (if current-selected "cancel" "select")])])]))

(rum/defc unpacked-plugin-loader
  [unpacked-pkg-path]
  (rum/use-effect!
   (fn []
     (when unpacked-pkg-path
       (doto js/LSPluginCore
         (.once "error"
                (fn [^js e]
                  (case (keyword (aget e "name"))
                    :IllegalPluginPackageError
                    (notification/show! "Illegal Logseq plugin package." :error)
                    :ExistedImportedPluginPackageError
                    (notification/show! "Existed Imported plugin package." :error))
                  (plugin-handler/reset-unpacked-state)))
         (.once "registered" #(plugin-handler/reset-unpacked-state))
         (.register (bean/->js {:url unpacked-pkg-path}))))
     #())
   [unpacked-pkg-path])

  (when unpacked-pkg-path
    [:strong.inline-flex.px-3 "Loading ..."]))

(rum/defc simple-markdown-display
  < rum/reactive
  []
  (let [content (state/sub :plugin/active-readme)]
    [:textarea.p-1.bg-transparent.border-none
     {:style {:width "700px" :min-height "60vw"}}
     content]))

(rum/defc installed-page
  < rum/reactive
  []
  (let [installed-plugins (state/sub :plugin/installed-plugins)
        selected-unpacked-pkg (state/sub :plugin/selected-unpacked-pkg)]
    [:div.cp__plugins-page-installed
     [:h1 "Installed Plugins"]
     [:div.mb-4.flex.items-center.justify-between
      (ui/button
       "Load unpacked plugin"
       :intent "logseq"
       :on-click plugin-handler/load-unpacked-plugin)
      (unpacked-plugin-loader selected-unpacked-pkg)
      (when (util/electron?)
        (ui/button
         [:span.flex.items-center
           ;;svg/settings-sm
          "Open plugin preferences file"]
         :intent "logseq"
         :on-click (fn []
                     (p/let [root (ipc/ipc "getLogseqUserRoot")]
                       (js/apis.openPath (str root "/preferences.json"))))))]

     [:div.lists.grid-cols-1.md:grid-cols-2.lg:grid-cols-3
      (for [[_ {:keys [id name settings version url]}] installed-plugins]
        (let [disabled (:disabled settings)]
          [:div.it {:key id}
           [:div.l.link-block {:on-click #(plugin-handler/open-readme! url simple-markdown-display)} svg/folder]
           [:div.r
            [:h3.link-block.text-xl.font-bold.pt-1.5
             {:on-click #(plugin-handler/open-readme! url simple-markdown-display)}
             [:strong name]
             [:sup.inline-block.px-1.text-xs.opacity-30 version]]
            [:p.text-xs.text-gray-400 (str "ID: " id)]

            [:div.ctl
             [:button.de.err ""]
             [:div.flex.items-center
              [:small.de (if disabled "Disabled" "Enabled")]
              (ui/toggle (not disabled)
                         (fn []
                           (js-invoke js/LSPluginCore (if disabled "enable" "disable") id))
                         true)]]]]))]]))

(defn open-select-theme!
  []
  (state/set-modal! installed-themes))