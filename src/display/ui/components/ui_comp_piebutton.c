// This file was generated by SquareLine Studio
// SquareLine Studio version: SquareLine Studio 1.4.0
// LVGL version: 8.3.11
// Project name: Gaggiuino

#include "../ui.h"


// COMPONENT PieButton

lv_obj_t *ui_PieButton_create(lv_obj_t *comp_parent) {

lv_obj_t *cui_PieButton;
cui_PieButton = lv_btn_create(comp_parent);
lv_obj_set_width( cui_PieButton, 121);
lv_obj_set_height( cui_PieButton, 50);
lv_obj_set_x( cui_PieButton, -3 );
lv_obj_set_y( cui_PieButton, -1 );
lv_obj_set_align( cui_PieButton, LV_ALIGN_CENTER );
lv_obj_add_flag( cui_PieButton, LV_OBJ_FLAG_SCROLL_ON_FOCUS );   /// Flags
lv_obj_clear_flag( cui_PieButton, LV_OBJ_FLAG_SCROLLABLE );    /// Flags
lv_obj_set_style_radius(cui_PieButton, 0, LV_PART_MAIN| LV_STATE_DEFAULT);

lv_obj_t ** children = lv_mem_alloc(sizeof(lv_obj_t *) * _UI_COMP_PIEBUTTON_NUM);
children[UI_COMP_PIEBUTTON_PIEBUTTON] = cui_PieButton;
lv_obj_add_event_cb(cui_PieButton, get_component_child_event_cb, LV_EVENT_GET_COMP_CHILD, children);
lv_obj_add_event_cb(cui_PieButton, del_component_child_event_cb, LV_EVENT_DELETE, children);
ui_comp_PieButton_create_hook(cui_PieButton);
return cui_PieButton; 
}
